import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  const { data: usage } = await supabase
    .from('api_usage')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single();

  return NextResponse.json({
    extraction_count: usage?.extraction_count ?? 0,
    chat_count: usage?.chat_count ?? 0,
  });
}
