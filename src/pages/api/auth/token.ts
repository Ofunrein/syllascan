import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, redirectUri, state } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const actualRedirectUri = redirectUri || (host ? `${proto}://${host}/oauth2callback` : null);

    if (!clientId || !clientSecret || !actualRedirectUri) {
      console.error('OAuth configuration missing');
      return res.status(500).json({ error: 'OAuth configuration missing' });
    }

    console.log('Exchanging code for tokens with redirect URI:', actualRedirectUri);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: actualRedirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange error:', errorData);
      return res.status(400).json({ error: 'Token exchange failed', details: errorData });
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful, access token received');

    if (tokenData.refresh_token) {
      console.log('Refresh token received');
    } else {
      console.warn('No refresh token received. The token will expire in 1 hour.');
    }

    const isProduction = process.env.NODE_ENV === 'production';

    const cookies = [
      `access_token=${tokenData.access_token}; HttpOnly; Path=/; Max-Age=${tokenData.expires_in}; SameSite=Lax${isProduction ? '; Secure' : ''}`,
    ];

    if (tokenData.refresh_token) {
      cookies.push(
        `refresh_token=${tokenData.refresh_token}; HttpOnly; Path=/; Max-Age=${365 * 24 * 60 * 60}; SameSite=Lax${isProduction ? '; Secure' : ''}`
      );
    }

    res.setHeader('Set-Cookie', cookies);

    // Also persist to Supabase so server-side routes can use and auto-refresh tokens
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const accessTokenCookie = req.cookies['sb-access-token'] || req.cookies['supabase-auth-token'];

      if (supabaseUrl && serviceRoleKey) {
        // Get user from Supabase session cookie
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        // Try to read user from the auth cookie header
        const authHeader = req.headers.cookie || '';
        const sbAccessMatch = authHeader.match(/sb-[^=]+-auth-token=([^;]+)/);
        if (sbAccessMatch) {
          try {
            const sessionStr = decodeURIComponent(sbAccessMatch[1]);
            const session = JSON.parse(sessionStr);
            const userId = session?.user?.id || session?.[0]?.user?.id;
            if (userId) {
              await supabase.from('users').update({
                google_calendar_connected: true,
                google_tokens: {
                  access_token: tokenData.access_token,
                  refresh_token: tokenData.refresh_token || null,
                  expires_at: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
                }
              }).eq('id', userId);
              console.log('Persisted Google tokens to Supabase for user:', userId);
            }
          } catch (parseErr) {
            console.warn('Could not parse session cookie for Supabase persistence:', parseErr);
          }
        }
      }
    } catch (supabaseErr) {
      // Non-fatal: cookies still work as fallback
      console.warn('Failed to persist tokens to Supabase:', supabaseErr);
    }

    let redirectUrl = '/?calendar_access=granted';

    if (state === 'calendar') {
      redirectUrl = '/?calendar_access=granted';
    } else if (state === 'test') {
      redirectUrl = '/test-google-auth?calendar_access=granted';
    }

    return res.status(200).json({
      success: true,
      expires_in: tokenData.expires_in,
      has_refresh_token: !!tokenData.refresh_token,
      redirect_url: redirectUrl
    });
  } catch (error) {
    console.error('Error handling token exchange:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
