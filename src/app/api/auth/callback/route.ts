import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization code from the query parameters
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state') || '';
    const error = searchParams.get('error');
    
    // Check if there was an error
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(new URL('/?auth_error=' + error, request.url));
    }
    
    // Check if the code is present
    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect(new URL('/?auth_error=no_code', request.url));
    }
    
    // Exchange the code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId || !clientSecret || !redirectUri) {
      console.error('OAuth configuration missing');
      return NextResponse.redirect(new URL('/?auth_error=config_missing', request.url));
    }
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange error:', errorData);
      return NextResponse.redirect(new URL('/?auth_error=token_exchange', request.url));
    }
    
    const tokenData = await tokenResponse.json();
    
    // Store the tokens securely (this would typically be done in a session or database)
    // For this example, we'll use cookies
    const response = NextResponse.redirect(new URL('/?auth_success=true', request.url));
    
    // Set secure HTTP-only cookies with the tokens
    // Note: In a production environment, you should use a more secure approach
    response.cookies.set('access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
      path: '/',
    });
    
    if (tokenData.refresh_token) {
      response.cookies.set('refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // Refresh tokens don't expire unless revoked
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });
    }
    
    // Add a success message based on the state
    if (state.includes('calendar')) {
      return NextResponse.redirect(new URL('/?calendar_access=granted', request.url));
    }
    
    return response;
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    return NextResponse.redirect(new URL('/?auth_error=server_error', request.url));
  }
} 