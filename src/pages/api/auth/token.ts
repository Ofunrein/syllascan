import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, redirectUri, state } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange the code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const actualRedirectUri = redirectUri || process.env.GOOGLE_REDIRECT_URI;

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
      console.log('Refresh token received, this is good!');
    } else {
      console.warn('No refresh token received. The token will expire in 1 hour.');
    }

    // Set cookies for the access token and refresh token
    // Use secure cookies in production
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Set the access token cookie
    const cookies = [
      `access_token=${tokenData.access_token}; HttpOnly; Path=/; Max-Age=${tokenData.expires_in}; SameSite=Lax${isProduction ? '; Secure' : ''}`,
    ];
    
    // Add refresh token cookie if available
    if (tokenData.refresh_token) {
      cookies.push(
        `refresh_token=${tokenData.refresh_token}; HttpOnly; Path=/; Max-Age=${365 * 24 * 60 * 60}; SameSite=Lax${isProduction ? '; Secure' : ''}`
      );
    }
    
    res.setHeader('Set-Cookie', cookies);

    // Determine the redirect URL based on the state parameter
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