import { createServiceRoleClient } from '@/lib/supabase/server';

export async function recordProcessingHistory(
  userId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  pageCount: number,
  eventsExtracted: number,
  status: 'completed' | 'failed'
) {
  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      page_count: pageCount,
      events_extracted: eventsExtracted,
      extraction_status: status,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
