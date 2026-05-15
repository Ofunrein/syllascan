import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getRefreshedClient, handleGoogleApiError } from '@/lib/google/calendar';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const auth = await getRefreshedClient(user.id);
    if (!auth) return NextResponse.json({ reconnectRequired: true }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const calendarIdsParam = searchParams.get('calendarIds') || searchParams.get('calendarId') || 'primary';
    const calendarIds = calendarIdsParam.split(',').map(s => s.trim()).filter(Boolean);
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = searchParams.get('timeMax') || new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString();

    const cal = google.calendar({ version: 'v3', auth });

    const results = await Promise.all(
      calendarIds.map(calId =>
        cal.events.list({
          calendarId: calId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250,
        }).then(r => ({ calId, items: r.data.items ?? [] }))
      )
    );

    const events = results.flatMap(({ calId, items }) =>
      items.map(e => ({
        id: e.id,
        calendarId: calId,
        title: e.summary,
        description: e.description,
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        allDay: Boolean(e.start?.date && !e.start?.dateTime),
        location: e.location,
        recurrence: e.recurrence?.[0],
        recurringEventId: e.recurringEventId,
        htmlLink: e.htmlLink,
        hangoutLink: e.hangoutLink,
        attendees: e.attendees?.map(a => ({
          email: a.email,
          displayName: a.displayName,
          responseStatus: a.responseStatus,
        })),
      }))
    );

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('Error in calendar events route:', error);
    return NextResponse.json({ error: error.message || 'Failed to get calendar events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const auth = await getRefreshedClient(user.id);
    if (!auth) return NextResponse.json({ reconnectRequired: true }, { status: 401 });

    const body = await request.json();
    const { calendarId = 'primary', event: eventBody, addMeet } = body;

    const resource: any = {
      summary: eventBody.title,
      description: eventBody.description,
      location: eventBody.location,
      start: eventBody.allDay
        ? { date: eventBody.start.split('T')[0] }
        : { dateTime: eventBody.start, timeZone: 'UTC' },
      end: eventBody.allDay
        ? { date: eventBody.end.split('T')[0] }
        : { dateTime: eventBody.end, timeZone: 'UTC' },
      colorId: eventBody.colorId,
      recurrence: eventBody.recurrence ? [eventBody.recurrence] : undefined,
      attendees: eventBody.guests?.map((email: string) => ({ email })),
    };

    if (addMeet) {
      resource.conferenceData = {
        createRequest: { requestId: Math.random().toString(36).slice(2) },
      };
    }

    const cal = google.calendar({ version: 'v3', auth });
    const res = await cal.events.insert({
      calendarId,
      requestBody: resource,
      conferenceDataVersion: addMeet ? 1 : 0,
    });

    return NextResponse.json({ event: res.data });
  } catch (err: any) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { reconnectRequired, message } = await handleGoogleApiError(err, user.id);
      return NextResponse.json({ error: message, reconnectRequired }, { status: reconnectRequired ? 401 : 500 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
