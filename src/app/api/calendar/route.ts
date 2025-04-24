import { NextRequest, NextResponse } from 'next/server';
import { addEventsToCalendar } from '@/lib/googleCalendar';
import { Event } from '@/lib/openai';
import { google } from 'googleapis';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { recordProcessingHistory } from '@/lib/processingHistory';

export async function POST(request: NextRequest) {
  try {
    // Try to get the access token from the Authorization header or cookies
    let accessToken = null;
    let refreshToken = null;
    let userId = null;
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.split('Bearer ')[1];
      
      // If we have a token in the Authorization header, try to get the user ID
      try {
        const auth = getFirebaseAdminAuth();
        const decodedToken = await auth.verifyIdToken(accessToken);
        userId = decodedToken.uid;
      } catch (authError) {
        console.error('Error verifying ID token:', authError);
        // Continue without user ID, we'll try to get it from cookies
      }
    }
    
    // Try to get tokens from cookies if not in Authorization header
    if (!accessToken) {
      const cookieToken = request.cookies.get('access_token');
      if (cookieToken) {
        accessToken = cookieToken.value;
      }
    }
    
    if (!refreshToken) {
      const cookieRefreshToken = request.cookies.get('refresh_token');
      if (cookieRefreshToken) {
        refreshToken = cookieRefreshToken.value;
      }
    }
    
    // Try to get userId from session cookie if not from token
    if (!userId) {
      const sessionCookie = request.cookies.get('session');
      if (sessionCookie) {
        try {
          const auth = getFirebaseAdminAuth();
          const decodedClaims = await auth.verifySessionCookie(sessionCookie.value);
          userId = decodedClaims.uid;
        } catch (sessionError) {
          console.error('Error verifying session cookie:', sessionError);
          // Continue without user ID
        }
      }
    }
    
    console.log('Access token found:', !!accessToken);
    console.log('Refresh token found:', !!refreshToken);
    console.log('User ID found:', !!userId);
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized - No access token provided' },
        { status: 401 }
      );
    }

    // Parse the request body
    const { events } = await request.json();

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'No events provided or invalid events format' },
        { status: 400 }
      );
    }

    try {
      // Use the addEventsToCalendar function from our utility
      const eventIds = await addEventsToCalendar(accessToken, events, refreshToken);
      
      // Record processing history if we have a user ID
      if (userId) {
        // Group events by source file if available
        const fileGroups = new Map<string, Event[]>();
        
        for (const event of events) {
          const sourceFile = event.sourceFile || 'Unknown File';
          if (!fileGroups.has(sourceFile)) {
            fileGroups.set(sourceFile, []);
          }
          fileGroups.get(sourceFile).push(event);
        }
        
        // Record processing history for each file
        for (const [fileName, fileEvents] of fileGroups.entries()) {
          // Get file type from first event if available
          const fileType = fileEvents[0].sourceFileType || 'application/octet-stream';
          
          await recordProcessingHistory({
            userId,
            fileName,
            fileType,
            eventCount: fileEvents.length,
            status: 'success',
          });
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Successfully added ${eventIds.length} events to calendar`,
        eventIds 
      });
    } catch (apiError: any) {
      console.error('Error in initial add events request:', apiError);
      
      // If we have a refresh token and it's an auth error, try to refresh and retry
      if (refreshToken && (apiError.code === 401 || (apiError.response && apiError.response.status === 401))) {
        console.log('Attempting to refresh token and retry adding events');
        
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
          
          console.log('Successfully refreshed access token');
          
          // Retry adding events with new token
          const eventIds = await addEventsToCalendar(newAccessToken, events);
          
          // Record processing history if we have a user ID
          if (userId) {
            // Group events by source file if available
            const fileGroups = new Map<string, Event[]>();
            
            for (const event of events) {
              const sourceFile = event.sourceFile || 'Unknown File';
              if (!fileGroups.has(sourceFile)) {
                fileGroups.set(sourceFile, []);
              }
              fileGroups.get(sourceFile).push(event);
            }
            
            // Record processing history for each file
            for (const [fileName, fileEvents] of fileGroups.entries()) {
              // Get file type from first event if available
              const fileType = fileEvents[0].sourceFileType || 'application/octet-stream';
              
              await recordProcessingHistory({
                userId,
                fileName,
                fileType,
                eventCount: fileEvents.length,
                status: 'success',
              });
            }
          }
          
          // Set the new access token in a cookie
          const response = NextResponse.json({ 
            success: true, 
            message: `Successfully added ${eventIds.length} events to calendar`,
            eventIds 
          });
          
          response.cookies.set({
            name: 'access_token',
            value: newAccessToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 3600 // 1 hour
          });
          
          return response;
        } catch (refreshError: any) {
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
        { error: apiError.message || 'Failed to add events to calendar' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in calendar add events route:', error);
    return NextResponse.json(
      { error: 'Failed to add events to calendar', details: error.toString() },
      { status: 500 }
    );
  }
} 