import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the requested scope from the query parameters
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || '';
    
    // Base scopes for authentication
    let scopes = ['profile', 'email'];
    
    // Add calendar scopes if requested
    if (scope.includes('calendar')) {
      scopes.push('https://www.googleapis.com/auth/calendar');
      scopes.push('https://www.googleapis.com/auth/calendar.events');
    }
    
    // Create the Google OAuth URL
    const clientId = process.env.GOOGLE_CLIENT_ID;
    // Use the redirect URI from environment variables
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'OAuth configuration missing' },
        { status: 500 }
      );
    }
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes.join(' '));
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    
    // Store the requested scope in the session or state parameter
    // For simplicity, we'll use a state parameter
    authUrl.searchParams.append('state', scope);
    
    // Redirect to the Google OAuth consent screen
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error creating OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to create authorization URL' },
      { status: 500 }
    );
  }
} 