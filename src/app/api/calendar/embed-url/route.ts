import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No valid session' },
        { status: 401 }
      );
    }

    // For now, just return a simple embed URL for the primary calendar
    const embedUrl = 'https://calendar.google.com/calendar/embed?' +
      'src=primary' +
      '&ctz=America/Chicago' +
      '&mode=WEEK' +
      '&showTitle=0' +
      '&showNav=1' +
      '&showDate=1' +
      '&showPrint=0' +
      '&showTabs=1' +
      '&showCalendars=0' +
      '&showTz=1' +
      '&height=600' +
      '&wkst=1';

    return NextResponse.json({
      embedUrl,
      message: 'Successfully generated embed URL'
    });
  } catch (error: any) {
    console.error('Error in embed-url route:', error);
    return NextResponse.json(
      { error: 'Failed to generate embed URL', details: error.message },
      { status: 500 }
    );
  }
}
