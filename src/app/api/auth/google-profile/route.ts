import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    // Try to get the access token from cookies
    let accessToken = null;
    let refreshToken = null;
    
    const accessTokenCookie = request.cookies.get('access_token');
    const refreshTokenCookie = request.cookies.get('refresh_token');
    
    if (accessTokenCookie) {
      accessToken = accessTokenCookie.value;
    }
    
    if (refreshTokenCookie) {
      refreshToken = refreshTokenCookie.value;
    }
    
    if (!accessToken) {
      console.log('No access token found in request');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No access token found' },
        { status: 401 }
      );
    }
    
    // Set up Google OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    // Create OAuth2 API instance
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    });
    
    try {
      // Get user info
      const userInfoResponse = await oauth2.userinfo.get();
      const userInfo = userInfoResponse.data;
      
      return NextResponse.json({ 
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      });
    } catch (apiError: any) {
      console.error('Error getting Google profile:', apiError);
      
      // If we have a refresh token and it's an auth error, try to refresh and retry
      if (refreshToken && (apiError.code === 401 || (apiError.response && apiError.response.status === 401))) {
        try {
          // Use the OAuth2 client to refresh the token
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
          );
          
          oauth2Client.setCredentials({
            refresh_token: refreshToken
          });
          
          const { credentials } = await oauth2Client.refreshAccessToken();
          const newAccessToken = credentials.access_token;
          
          if (!newAccessToken) {
            throw new Error('Failed to refresh access token');
          }
          
          // Set up Google OAuth2 client with new token
          oauth2Client.setCredentials({ access_token: newAccessToken });
          
          // Create OAuth2 API instance
          const oauth2 = google.oauth2({
            auth: oauth2Client,
            version: 'v2'
          });
          
          // Retry with new token
          const userInfoResponse = await oauth2.userinfo.get();
          const userInfo = userInfoResponse.data;
          
          // Set the new access token in a cookie
          const apiResponse = NextResponse.json({ 
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture
          });
          
          apiResponse.cookies.set({
            name: 'access_token',
            value: newAccessToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 3600 // 1 hour
          });
          
          return apiResponse;
        } catch (refreshError) {
          console.error('Error refreshing token:', refreshError);
          return NextResponse.json(
            { error: 'Failed to refresh authentication. Please sign in again.' },
            { status: 401 }
          );
        }
      }
      
      // If we couldn't refresh or it's not an auth error, return the original error
      if (apiError.code === 401 || (apiError.response && apiError.response.status === 401)) {
        return NextResponse.json(
          { error: 'Authentication failed. Please reauthorize Google access.' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to get Google profile', details: apiError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in Google profile route:', error);
    return NextResponse.json(
      { error: 'Failed to get Google profile', details: error.message },
      { status: 500 }
    );
  }
} 