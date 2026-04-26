import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Resolve user from Supabase auth
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read tokens from Supabase first, fall back to cookies
    const { data: profile } = await supabase
      .from('users')
      .select('google_tokens')
      .eq('id', user.id)
      .single();

    let accessToken = profile?.google_tokens?.access_token || null;
    let refreshToken = profile?.google_tokens?.refresh_token || null;

    // Cookie fallback for existing sessions
    if (!accessToken) {
      accessToken = request.cookies.get('access_token')?.value || null;
    }
    if (!refreshToken) {
      refreshToken = request.cookies.get('refresh_token')?.value || null;
    }

    console.log('Access token found:', !!accessToken);
    console.log('Refresh token found:', !!refreshToken);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get calendar ID from query params (default to primary)
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId') || 'primary';

    // Get time range from query params (default to 1 month)
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = searchParams.get('timeMax') || new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString();

    // Set up Google Calendar API
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      // Fetch events
      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100
      });

      const events = response.data.items || [];

      // Format events for the frontend
      const formattedEvents = events.map(event => ({
        id: event.id,
        title: event.summary,
        description: event.description,
        startDate: event.start?.dateTime || event.start?.date,
        endDate: event.end?.dateTime || event.end?.date,
        location: event.location,
        isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
        htmlLink: event.htmlLink
      }));

      return NextResponse.json({
        events: formattedEvents
      });
    } catch (apiError: any) {
      console.error('Error in initial calendar events request:', apiError);

      // If we have a refresh token and it's an auth error, try to refresh and retry
      if (refreshToken && (apiError.code === 401 || (apiError.response && apiError.response.status === 401))) {
        console.log('Attempting to refresh token and retry calendar events request');

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
          const serviceClient = await createServiceRoleClient();
          await serviceClient.from('users').update({
            google_tokens: { access_token: newAccessToken, refresh_token: refreshToken }
          }).eq('id', user.id);

          // Set up Google Calendar API with new token
          oauth2Client.setCredentials({ access_token: newAccessToken });
          const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

          // Retry fetch events with new token
          const response = await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 100
          });

          const events = response.data.items || [];

          // Format events for the frontend
          const formattedEvents = events.map(event => ({
            id: event.id,
            title: event.summary,
            description: event.description,
            startDate: event.start?.dateTime || event.start?.date,
            endDate: event.end?.dateTime || event.end?.date,
            location: event.location,
            isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
            htmlLink: event.htmlLink
          }));

          // Also set the new access token in a cookie for backward compat
          const apiResponse = NextResponse.json({ events: formattedEvents });
          apiResponse.cookies.set({
            name: 'access_token',
            value: newAccessToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 3600
          });

          return apiResponse;
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
        { error: apiError.message || 'Failed to get calendar events' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in calendar events route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get calendar events' },
      { status: 500 }
    );
  }
}
