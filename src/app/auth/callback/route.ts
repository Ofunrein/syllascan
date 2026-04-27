import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/scan';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    const user = data.user;

    if (!error && user) {
      const serviceClient = await createServiceRoleClient();
      const { data: existingProfile } = await serviceClient
        .from('users')
        .select('google_tokens, google_calendar_connected')
        .eq('id', user.id)
        .single();

      const accessToken = data.session?.provider_token ?? existingProfile?.google_tokens?.access_token ?? null;
      const refreshToken = data.session?.provider_refresh_token ?? existingProfile?.google_tokens?.refresh_token ?? null;
      const metadata = user.user_metadata ?? {};

      // Any Google sign-in always requests calendar scopes with prompt:consent,
      // so mark calendar connected for all Google provider sign-ins regardless
      // of whether provider_token is present (Supabase PKCE often omits it).
      const isGoogleSignIn = user.app_metadata?.provider === 'google'
        || user.app_metadata?.providers?.includes('google');

      await serviceClient.from('users').upsert({
        id: user.id,
        email: user.email ?? '',
        display_name: metadata.full_name ?? metadata.name ?? user.email?.split('@')[0] ?? null,
        avatar_url: metadata.avatar_url ?? metadata.picture ?? null,
        google_calendar_connected: isGoogleSignIn || Boolean(accessToken) || Boolean(existingProfile?.google_calendar_connected),
        google_tokens: accessToken
          ? { access_token: accessToken, refresh_token: refreshToken }
          : existingProfile?.google_tokens ?? null,
      }, { onConflict: 'id' });

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
