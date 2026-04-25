import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PARSE_PROMPT_TEMPLATE = `You are a calendar event parser. Convert the user's natural language input into a structured calendar event.

Return a JSON object with these fields:
- title (required): Clear event name
- description: Brief details (optional)
- date: YYYY-MM-DD format (use today's date context if relative like "tomorrow", "next friday")
- startTime: HH:MM 24-hour format
- endTime: HH:MM 24-hour format
- location: If mentioned
- type: One of "exam", "assignment", "discussion", "reading", "class", "meeting", "personal", "other"
- category: One of "academic", "personal", "work", "other"
- isAllDay: true/false
- isRecurring: true/false
- recurrencePattern: e.g. "weekly on Monday" (only if recurring)

Today's date is: __TODAY__

Return a JSON object with key "event" containing the parsed event. If the input doesn't look like an event, return {"event": null, "message": "explanation"}.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { input } = await request.json();

    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = PARSE_PROMPT_TEMPLATE.replace('__TODAY__', today);

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ event: null, message: 'Failed to parse input' });
    }

    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('NLP parse error:', error);
    return NextResponse.json({ error: 'Failed to parse event' }, { status: 500 });
  }
}
