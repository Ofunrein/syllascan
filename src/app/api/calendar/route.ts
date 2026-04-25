import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { addEventsToCalendar } from '@/lib/googleCalendar';
import { Event } from '@/lib/openai';
import { google } from 'googleapis';
import { recordProcessingHistory } from '@/lib/processingHistory';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    // Get Google tokens from Supabase user profile, with cookie fallback
    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    if (userId) {
      const { data: profile } = await supabase
        .from('users')
        .select('google_tokens')
        .eq('id', userId)
        .single();

      accessToken = profile?.google_tokens?.access_token || null;
      refreshToken = profile?.google_tokens?.refresh_token || null;
    }

    // Cookie-based fallback for existing sessions
    if (!accessToken) {
      accessToken = request.cookies.get('access_token')?.value || null;
    }
    if (!refreshToken) {
      refreshToken = request.cookies.get('refresh_token')?.value || null;
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
        const fileGroups = new Map<string, Event[]>();

        for (const event of events) {
          const sourceFile = event.sourceFile || 'Unknown File';
          if (!fileGroups.has(sourceFile)) {
            fileGroups.set(sourceFile, []);
          }
          fileGroups.get(sourceFile)!.push(event);
        }

        for (const [fileName, fileEvents] of fileGroups.entries()) {
          const fileType = fileEvents[0].sourceFileType || 'application/octet-stream';

          await recordProcessingHistory(
            userId,
            fileName,
            fileType,
            0, // fileSize unknown in this context
            0, // pageCount unknown in this context
            fileEvents.length,
            'completed'
          );
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

          // Persist refreshed token back to Supabase
          if (userId) {
            const serviceClient = await createServiceRoleClient();
            await serviceClient.from('users').update({
              google_tokens: { access_token: newAccessToken, refresh_token: refreshToken }
            }).eq('id', userId);
          }

          // Retry adding events with new token
          const eventIds = await addEventsToCalendar(newAccessToken, events);

          // Record processing history if we have a user ID
          if (userId) {
            const fileGroups = new Map<string, Event[]>();

            for (const event of events) {
              const sourceFile = event.sourceFile || 'Unknown File';
              if (!fileGroups.has(sourceFile)) {
                fileGroups.set(sourceFile, []);
              }
              fileGroups.get(sourceFile)!.push(event);
            }

            for (const [fileName, fileEvents] of fileGroups.entries()) {
              const fileType = fileEvents[0].sourceFileType || 'application/octet-stream';

              await recordProcessingHistory(
                userId,
                fileName,
                fileType,
                0,
                0,
                fileEvents.length,
                'completed'
              );
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
