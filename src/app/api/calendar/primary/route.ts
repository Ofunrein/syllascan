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
    
    // Set up Google Calendar API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    try {
      // Get the primary calendar
      const response = await calendar.calendarList.get({ calendarId: 'primary' });
      
      return NextResponse.json({ 
        calendarId: response.data.id,
        summary: response.data.summary
      });
    } catch (apiError: any) {
      console.error('Error getting primary calendar:', apiError);
      
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
          
          // Set up Google Calendar API with new token
          oauth2Client.setCredentials({ access_token: newAccessToken });
          const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
          
          // Retry with new token
          const response = await calendar.calendarList.get({ calendarId: 'primary' });
          
          // Set the new access token in a cookie
          const apiResponse = NextResponse.json({ 
            calendarId: response.data.id,
            summary: response.data.summary
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
          { error: 'Authentication failed. Please reauthorize calendar access.' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to get primary calendar', details: apiError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in primary calendar route:', error);
    return NextResponse.json(
      { error: 'Failed to get primary calendar', details: error.message },
      { status: 500 }
    );
  }
} 