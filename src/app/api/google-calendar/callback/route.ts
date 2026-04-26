import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const next = state?.startsWith('/') ? state : '/scan#live-calendar';

  if (error || !code) {
    return NextResponse.redirect(`${origin}/scan?calendar_error=denied#live-calendar`);
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/?error=not_authenticated`);
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || origin}/api/google-calendar/callback`,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenResponse.json();

  if (!tokenResponse.ok) {
    return NextResponse.redirect(`${origin}/scan?calendar_error=token_exchange_failed#live-calendar`);
  }

  const serviceClient = await createServiceRoleClient();
  const { data: existingProfile } = await serviceClient
    .from('users')
    .select('google_tokens')
    .eq('id', user.id)
    .single();

  const metadata = user.user_metadata ?? {};
  await serviceClient
    .from('users')
    .upsert({
      id: user.id,
      email: user.email ?? '',
      display_name: metadata.full_name ?? metadata.name ?? user.email?.split('@')[0] ?? null,
      avatar_url: metadata.avatar_url ?? metadata.picture ?? null,
      google_calendar_connected: true,
      google_tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? existingProfile?.google_tokens?.refresh_token ?? null,
      },
    }, { onConflict: 'id' });

  const separator = next.includes('?') ? '&' : '?';
  const [path, hash] = next.split('#');
  return NextResponse.redirect(`${origin}${path}${separator}calendar_connected=true${hash ? `#${hash}` : ''}`);
}
