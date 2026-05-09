import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('events')
    .select('source, google_event_id')
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to load event summary' }, { status: 500 });
  }

  const events = (data || []) as Array<{ source: string | null; google_event_id: string | null }>;
  const extracted = events.filter(event => event.source === 'extraction').length;
  const manual = events.filter(event => event.source === 'manual').length;
  const synced = events.filter(event => Boolean(event.google_event_id)).length;

  return NextResponse.json({
    total: events.length,
    extracted,
    manual,
    synced,
  });
}
