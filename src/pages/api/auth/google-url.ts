import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    // Get the state parameter from the query string
    const { state, prompt } = req.query;
    const stateParam = state ? String(state) : 'calendar';
    
    // If prompt is 'select_account', use it to force account selection
    // Otherwise, use 'consent' to ensure we get a refresh token
    const promptParam = prompt === 'select_account' ? 'select_account' : 'consent';

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('OAuth configuration missing');
      return res.status(500).json({ error: 'OAuth configuration missing' });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Generate a URL for requesting calendar access
    // Make sure to include all necessary scopes and set access_type to offline to get a refresh token
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: stateParam, // Pass the state parameter to identify the source of the request
      prompt: promptParam, // Use the prompt parameter (consent or select_account)
      include_granted_scopes: true
    });

    console.log(`Generated auth URL for Google OAuth with state: ${stateParam} and prompt: ${promptParam}`);
    return res.status(200).json({ url: authUrl });
  } catch (error) {
    console.error('Error generating Google OAuth URL:', error);
    return res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
} 