import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getRefreshedClient, handleGoogleApiError } from '@/lib/google/calendar';
import { google } from 'googleapis';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await getRefreshedClient(user.id);
  if (!auth) return NextResponse.json({ reconnectRequired: true }, { status: 401 });

  try {
    const cal = google.calendar({ version: 'v3', auth });
    const res = await cal.calendarList.list({ minAccessRole: 'freeBusyReader' });
    const items = (res.data.items ?? []).map(c => ({
      id: c.id,
      summary: c.summary,
      backgroundColor: c.backgroundColor ?? '#3b82f6',
      foregroundColor: c.foregroundColor ?? '#ffffff',
      accessRole: c.accessRole,
      primary: c.primary ?? false,
    }));
    return NextResponse.json({ calendars: items });
  } catch (err: any) {
    const { reconnectRequired, message } = await handleGoogleApiError(err, user.id);
    return NextResponse.json({ error: message, reconnectRequired }, { status: reconnectRequired ? 401 : 500 });
  }
}
