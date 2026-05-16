import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import type { ConversationMessage, AssistantAction } from '@/components/assistant/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = (today: string, tz: string, eventsJSON: string) => `
You are an AI calendar assistant for SyllaScan. You have FULL access to the user's calendar — you can READ events, CREATE events, EDIT events, MOVE events, and DELETE events via natural language or voice.

Today's date: ${today}
User's timezone: ${tz}

The user's calendar events (past 14 days → next 60 days):
${eventsJSON}

When the user asks to READ or QUERY the calendar (e.g. "what's on today?", "what do I have this week?", "when is my next meeting?"), answer directly from the events list above in a friendly, concise format. Return empty actions array.

When the user asks to MODIFY the calendar, return the appropriate actions and confirm in the reply.

Respond with valid JSON:
{
  "reply": "your response — for reads: a clear summary of the events. For mutations: confirm what you're doing.",
  "actions": [
    { "type": "CREATE", "event": { "title": "string", "start": "ISO datetime", "end": "ISO datetime", "allDay": false, "description": null, "location": null, "calendarId": "primary", "color": null } },
    { "type": "EDIT", "eventId": "string", "calendarId": "string", "changes": { "title"?: "string", "start"?: "ISO", "end"?: "ISO", "description"?: "string", "location"?: "string" } },
    { "type": "MOVE", "eventId": "string", "calendarId": "string", "newStart": "ISO", "newEnd": "ISO" },
    { "type": "DELETE", "eventId": "string", "calendarId": "string", "title": "string" }
  ]
}

Rules:
- For READ queries: return empty actions [], answer in reply.
- Resolve relative dates against today (${today}).
- Default calendarId is "primary" for CREATE.
- All-day events: allDay true, start/end YYYY-MM-DDT00:00:00.000Z.
- If ambiguous, ask for clarification.
- Format event times in the user's local timezone when displaying in reply.
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
