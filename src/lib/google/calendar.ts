// src/lib/google/calendar.ts
import { google } from 'googleapis';
import { createServiceRoleClient } from '@/lib/supabase/server';

export interface TokenBundle {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

export async function getTokensForUser(userId: string): Promise<TokenBundle | null> {
  const serviceClient = await createServiceRoleClient();
  const { data: profile } = await serviceClient
    .from('users')
    .select('google_tokens')
    .eq('id', userId)
    .single();

  const tokens = profile?.google_tokens as any;
  if (!tokens?.access_token) return null;

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expires_at ?? null,
  };
}

export async function getRefreshedClient(userId: string): Promise<any | null> {
  const tokens = await getTokensForUser(userId);
  if (!tokens) return null;

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? undefined,
    expiry_date: tokens.expiresAt ?? undefined,
  });

  const expiresSoon = tokens.expiresAt && tokens.expiresAt - Date.now() < 5 * 60 * 1000;
  if (expiresSoon && tokens.refreshToken) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      if (credentials.access_token) {
        const serviceClient = await createServiceRoleClient();
        await serviceClient.from('users').update({
          google_tokens: {
            access_token: credentials.access_token,
            refresh_token: tokens.refreshToken,
            expires_at: credentials.expiry_date ?? Date.now() + 3600000,
          },
        }).eq('id', userId);
        oauth2.setCredentials(credentials);
      }
    } catch {
      // proceed with existing token; will fail at API call if truly expired
    }
  }

  return oauth2;
}

export async function handleGoogleApiError(
  error: any,
  userId: string
): Promise<{ reconnectRequired: boolean; message: string }> {
  const status = error?.code ?? error?.response?.status ?? 0;
  const msg: string = error?.message ?? '';

  if (status === 401 || msg.toLowerCase().includes('invalid_grant')) {
    const serviceClient = await createServiceRoleClient();
    await serviceClient.from('users').update({ google_calendar_connected: false }).eq('id', userId);
    return { reconnectRequired: true, message: 'Google Calendar disconnected. Please reconnect.' };
  }
  if (status === 403 && (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('permission'))) {
    return { reconnectRequired: true, message: 'Missing calendar permission. Please reconnect.' };
  }
  return { reconnectRequired: false, message: msg || 'Google Calendar API error.' };
}
