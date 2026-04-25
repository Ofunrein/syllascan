import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/dashboard?calendar_error=denied`);
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
    return NextResponse.redirect(`${origin}/dashboard?calendar_error=token_exchange_failed`);
  }

  const serviceClient = await createServiceRoleClient();
  await serviceClient
    .from('users')
    .update({
      google_calendar_connected: true,
      google_tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      },
    })
    .eq('id', user.id);

  return NextResponse.redirect(`${origin}/dashboard?calendar_connected=true`);
}
