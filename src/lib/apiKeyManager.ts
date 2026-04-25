import { createServiceRoleClient } from '@/lib/supabase/server';

export async function incrementUsage(userId: string, field: 'extraction_count' | 'chat_count') {
  const supabase = await createServiceRoleClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('api_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (existing) {
    await supabase
      .from('api_usage')
      .update({ [field]: (existing[field] || 0) + 1 })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('api_usage')
      .insert({
        user_id: userId,
        date: today,
        [field]: 1,
      });
  }
}

export async function getUsage(userId: string) {
  const supabase = await createServiceRoleClient();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('api_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  return {
    extraction_count: data?.extraction_count ?? 0,
    chat_count: data?.chat_count ?? 0,
  };
}
