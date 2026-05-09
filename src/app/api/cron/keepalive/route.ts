import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createServiceRoleClient();
    const touchedAt = new Date().toISOString();

    const { data, error } = await supabase
      .from('keepalive' as never)
      .upsert(
        {
          id: 1,
          touched_at: touchedAt,
          source: 'vercel-cron',
        } as never,
        { onConflict: 'id' }
      )
      .select('id,touched_at,source')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Keepalive write failed', detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      project: 'syllascan',
      keepalive: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Keepalive failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
