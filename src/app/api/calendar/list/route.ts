import { NextRequest, NextResponse } from 'next/server';
import { getUserCalendars } from '@/lib/googleCalendar';

export async function GET(request: NextRequest) {
  try {
    // Try to get the access token from the Authorization header or cookies
    let accessToken = null;
    let refreshToken = null;
    
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.split('Bearer ')[1];
    } else {
      // Try to get the tokens from cookies
      const accessTokenCookie = request.cookies.get('access_token');
      const refreshTokenCookie = request.cookies.get('refresh_token');
      
      if (accessTokenCookie) {
        accessToken = accessTokenCookie.value;
      }
      
      if (refreshTokenCookie) {
        refreshToken = refreshTokenCookie.value;
      }
    }
    
    if (!accessToken) {
      console.log('No access token found in request');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No access token found' },
        { status: 401 }
      );
    }
    
    console.log('Access token found, length:', accessToken.length);
    if (refreshToken) {
      console.log('Refresh token found, will use for token refresh if needed');
    }
    
    // Get user calendars
    const calendars = await getUserCalendars(accessToken, refreshToken);

    return NextResponse.json({ 
      calendars
    });
  } catch (error: any) {
    console.error('Error getting calendars:', error);
    
    // Check if it's an authentication error
    if (error.code === 401 || (error.response && error.response.status === 401)) {
      return NextResponse.json(
        { error: 'Authentication failed. Please reauthorize calendar access.', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to get calendars', details: error.message },
      { status: 500 }
    );
  }
} 