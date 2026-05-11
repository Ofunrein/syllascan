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
        .select('google_tokens')
        .eq('id', user.id)
        .single();

      const metadata = user.user_metadata ?? {};

      // Preserve existing calendar tokens — they have calendar.events scope.
      // Supabase provider_token only has email/profile scope and must not overwrite them.
      const hasCalendarTokens = !!existingProfile?.google_tokens?.refresh_token;
      const calendarTokens = hasCalendarTokens
        ? existingProfile!.google_tokens
        : null;

      await serviceClient.from('users').upsert({
        id: user.id,
        email: user.email ?? '',
        display_name: metadata.full_name ?? metadata.name ?? user.email?.split('@')[0] ?? null,
        avatar_url: metadata.avatar_url ?? metadata.picture ?? null,
        google_calendar_connected: hasCalendarTokens,
        google_tokens: calendarTokens,
      }, { onConflict: 'id' });

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
