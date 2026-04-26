import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const next = state?.startsWith('/') ? state : '/scan#live-calendar';

  if (error || !code) {
    console.error('[calendar-callback] OAuth error or missing code:', error);
    return NextResponse.redirect(`${origin}/scan?calendar_error=${encodeURIComponent(error || 'no_code')}`);
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[calendar-callback] No authenticated user:', authError?.message);
    return NextResponse.redirect(`${origin}/?error=not_authenticated`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  const redirectUri = `${appUrl}/api/google-calendar/callback`;

  console.log('[calendar-callback] Exchanging code for tokens, redirect_uri:', redirectUri);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error('[calendar-callback] Token exchange failed:', JSON.stringify(tokens));
    return NextResponse.redirect(
      `${origin}/scan?calendar_error=${encodeURIComponent(tokens.error_description || tokens.error || 'token_exchange_failed')}`
    );
  }

  console.log('[calendar-callback] Got tokens, saving for user:', user.id);

  const serviceClient = await createServiceRoleClient();
  const { data: existingProfile } = await serviceClient
    .from('users')
    .select('google_tokens')
    .eq('id', user.id)
    .single();

  const metadata = user.user_metadata ?? {};
  const { error: upsertError } = await serviceClient
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

  if (upsertError) {
    console.error('[calendar-callback] Failed to save tokens:', upsertError.message);
  } else {
    console.log('[calendar-callback] Tokens saved successfully');
  }

  const [path, hash] = next.split('#');
  const sep = path.includes('?') ? '&' : '?';
  return NextResponse.redirect(`${origin}${path}${sep}calendar_connected=true${hash ? `#${hash}` : ''}`);
}
