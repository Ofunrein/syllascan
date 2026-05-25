import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getRefreshedClient, handleGoogleApiError } from '@/lib/google/calendar';
import { google } from 'googleapis';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await getRefreshedClient(user.id);
  if (!auth) return NextResponse.json({ reconnectRequired: true }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get('calendarId') ?? 'primary';
  const updateScope = (searchParams.get('updateScope') ?? 'single') as 'single' | 'following' | 'all';

  const body = await request.json();
  const { event: eventBody } = body;
  const tz = eventBody.timezone || eventBody.timeZone || 'UTC';

  const resource: any = {};
  if (eventBody.title !== undefined) resource.summary = eventBody.title;
  if (eventBody.description !== undefined) resource.description = eventBody.description;
  if (eventBody.location !== undefined) resource.location = eventBody.location;
  if (eventBody.start !== undefined) {
    resource.start = eventBody.allDay
      ? { date: eventBody.start.split('T')[0] }
      : { dateTime: eventBody.start, timeZone: tz };
  }
  if (eventBody.end !== undefined) {
    resource.end = eventBody.allDay
      ? { date: eventBody.end.split('T')[0] }
      : { dateTime: eventBody.end, timeZone: tz };
  }
  if (eventBody.color !== undefined) resource.colorId = eventBody.color || undefined;
  if (eventBody.recurrence) resource.recurrence = [eventBody.recurrence];
  if (eventBody.guests) resource.attendees = eventBody.guests.map((email: string) => ({ email }));

  const cal = google.calendar({ version: 'v3', auth });

  try {
    if (updateScope === 'all') {
      const masterId = id.split('_')[0];
      const res = await cal.events.patch({ calendarId, eventId: masterId, requestBody: resource });
      return NextResponse.json({ event: res.data });
    }

    if (updateScope === 'following') {
      const instanceDate = id.split('_')[1];
      if (!instanceDate) {
        return NextResponse.json({ error: 'Invalid recurring event id for following scope' }, { status: 400 });
      }
      const masterRes = await cal.events.get({ calendarId, eventId: id.split('_')[0] });
      const masterRecurrence = masterRes.data.recurrence?.[0] ?? '';
      // Use full instanceDate as UNTIL (already in YYYYMMDDTHHMMSSZ format for timed events)
      const untilDate = instanceDate;
      const updatedRule = masterRecurrence ? `${masterRecurrence};UNTIL=${untilDate}` : masterRecurrence;

      await cal.events.patch({
        calendarId,
        eventId: id.split('_')[0],
        requestBody: { recurrence: [updatedRule] },
      });

      // New series from this instance: carry the original recurrence rule
      const newSeriesResource = { ...resource };
      if (masterRecurrence && !newSeriesResource.recurrence) {
        newSeriesResource.recurrence = [masterRecurrence];
      }
      const newRes = await cal.events.insert({ calendarId, requestBody: newSeriesResource });
      return NextResponse.json({ event: newRes.data });
    }

    const res = await cal.events.patch({ calendarId, eventId: id, requestBody: resource });
    return NextResponse.json({ event: res.data });
  } catch (err: any) {
    const { reconnectRequired, message } = await handleGoogleApiError(err, user.id);
    return NextResponse.json({ error: message, reconnectRequired }, { status: reconnectRequired ? 401 : 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await getRefreshedClient(user.id);
  if (!auth) return NextResponse.json({ reconnectRequired: true }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get('calendarId') ?? 'primary';
  const updateScope = (searchParams.get('updateScope') ?? 'single') as 'single' | 'following' | 'all';

  const cal = google.calendar({ version: 'v3', auth });

  try {
    if (updateScope === 'all') {
      await cal.events.delete({ calendarId, eventId: id.split('_')[0] });
    } else if (updateScope === 'following') {
      const instanceDate = id.split('_')[1];
      if (!instanceDate) {
        return NextResponse.json({ error: 'Invalid recurring event id for following scope' }, { status: 400 });
      }
      const masterRes = await cal.events.get({ calendarId, eventId: id.split('_')[0] });
      const masterRecurrence = masterRes.data.recurrence?.[0] ?? '';
      const untilDate = instanceDate;
      const updatedRule = masterRecurrence ? `${masterRecurrence};UNTIL=${untilDate}` : masterRecurrence;
      await cal.events.patch({
        calendarId,
        eventId: id.split('_')[0],
        requestBody: { recurrence: [updatedRule] },
      });
    } else {
      await cal.events.delete({ calendarId, eventId: id });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const { reconnectRequired, message } = await handleGoogleApiError(err, user.id);
    return NextResponse.json({ error: message, reconnectRequired }, { status: reconnectRequired ? 401 : 500 });
  }
}
