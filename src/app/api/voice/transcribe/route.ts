import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await request.formData();
  const audio = form.get('audio') as File | null;

  if (!audio) return NextResponse.json({ error: 'No audio file' }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: 'Recording too long (max 2 min)' }, { status: 400 });

  try {
    const result = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audio,
      response_format: 'text',
    });
    return NextResponse.json({ transcript: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Transcription failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
