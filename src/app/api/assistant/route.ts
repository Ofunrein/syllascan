import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import type { ConversationMessage, AssistantAction } from '@/components/assistant/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = (today: string, tz: string, eventsJSON: string) => `
You are an AI calendar assistant for SyllaScan. Users can ask you to create, edit, move, or delete calendar events using natural language or voice.

Today's date: ${today}
User's timezone: ${tz}

Current calendar events (for context when user mentions "that meeting" etc.):
${eventsJSON}

Respond with valid JSON matching this schema:
{
  "reply": "conversational response",
  "actions": [
    { "type": "CREATE", "event": { "title": "string", "start": "ISO datetime", "end": "ISO datetime", "allDay": false, "description": null, "location": null, "calendarId": "primary", "color": null } },
    { "type": "EDIT", "eventId": "string", "calendarId": "string", "changes": { "title"?: "string", "start"?: "ISO", "end"?: "ISO" } },
    { "type": "MOVE", "eventId": "string", "calendarId": "string", "newStart": "ISO", "newEnd": "ISO" },
    { "type": "DELETE", "eventId": "string", "calendarId": "string", "title": "string" }
  ]
}

Rules:
- If ambiguous, ask for clarification and return empty actions array.
- Resolve relative dates ("tomorrow", "next Friday") against today.
- Default calendarId is "primary" for CREATE.
- All-day: set allDay true, start/end to YYYY-MM-DDT00:00:00.000Z.
- Always confirm what you're doing in the reply.
`.trim();

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    message: string;
    history: ConversationMessage[];
    calendarEvents: Array<{ id: string; calendarId: string; title: string; start: string; end: string; allDay: boolean }>;
    timezone?: string;
  };

  const today = new Date().toISOString().split('T')[0];
  const tz = body.timezone ?? 'UTC';
  const eventsJSON = JSON.stringify(
    (body.calendarEvents ?? []).map(e => ({ id: e.id, calendarId: e.calendarId, title: e.title, start: e.start, end: e.end, allDay: e.allDay })),
    null, 2
  );

  const historyMessages = (body.history ?? []).slice(-20).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT(today, tz, eventsJSON) },
        ...historyMessages,
        { role: 'user', content: body.message },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content ?? '{"reply":"Sorry, I had trouble with that.","actions":[]}';
    const parsed = JSON.parse(raw) as { reply: string; actions: AssistantAction[] };

    return NextResponse.json({
      reply: parsed.reply ?? 'Done.',
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Assistant failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
