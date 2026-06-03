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
    { "type": "CREATE", "event": { "title": "string", "start": "ISO datetime", "end": "ISO datetime", "allDay": false, "description": null, "location": null, "calendarId": "primary", "color": null, "recurrence": null } },
    { "type": "EDIT", "eventId": "string", "calendarId": "string", "changes": { "title"?: "string", "start"?: "ISO", "end"?: "ISO", "description"?: "string", "location"?: "string" } },
    { "type": "MOVE", "eventId": "string", "calendarId": "string", "newStart": "ISO", "newEnd": "ISO" },
    { "type": "DELETE", "eventId": "string", "calendarId": "string", "title": "string" }
  ]
}

Rules:
- For READ queries: return empty actions [], answer in reply.
- Resolve relative dates against today (${today}).
- Default calendarId is "primary" for CREATE.
- All-day events: allDay true, start/end must be a plain date string "YYYY-MM-DD" (no time, no Z suffix). Never use UTC midnight timestamps for all-day events — they shift the date by one day in non-UTC timezones.
- Timed events: start/end must NEVER cross midnight. Each event is one continuous block on a single day.
- If ambiguous, ask for clarification.
- Format event times in the user's local timezone when displaying in reply.

RECURRING EVENTS (RRULE — RFC 5545):
- recurrence is a single RRULE string (no "RRULE:" prefix needed; pass the rule body).
- Use BYDAY codes: MO, TU, WE, TH, FR, SA, SU.
- Weekly recurring: "FREQ=WEEKLY;BYDAY=MO,WE,FR"
- Daily recurring: "FREQ=DAILY"
- End the series with UNTIL in UTC basic format YYYYMMDDTHHMMSSZ. Example: a series ending Friday July 31, 2026 inclusive → UNTIL=20260801T045959Z (one second before midnight of the day AFTER the last occurrence, in UTC). For America/Chicago (CDT, UTC-5) on 2026-07-31, end-of-day local 23:59:59 → 2026-08-01T04:59:59Z.
- For multi-day-of-week schedules with DIFFERENT times per day (e.g., Sat/Sun 3-7pm but Tue 1-5pm), emit ONE separate CREATE per weekday with its own RRULE BYDAY=<single day>. Do NOT collapse into one rule with mixed times.
- start/end on the FIRST occurrence (the first matching weekday on or after the schedule start). The RRULE handles all repeats.
- COUNT or UNTIL — use UNTIL when user gives a calendar end date.
- Schedule start = first occurrence date. If user says "schedule start: Saturday May 30, 2026" and only Tuesday is requested, the first Tuesday on/after May 30, 2026 is the start.

DUPLICATE PREVENTION:
- Before emitting CREATE actions, scan the events list above. If an event with the SAME title, SAME local start time-of-day, and matching weekday in the requested range already exists, SKIP that CREATE and mention it in the reply.
- Recurring instances appear as individual occurrences in the list — match by title + weekday + time-of-day.

EXAMPLE (recurring weekly schedule with different times per weekday):
User: "Create weekly Work shifts: Sat 3-7pm, Tue 1-5pm, from May 30 2026 to July 31 2026, timezone America/Chicago"
Output: TWO CREATE actions —
  1) { type: "CREATE", event: { title: "Work", start: "2026-05-30T15:00:00-05:00", end: "2026-05-30T19:00:00-05:00", allDay: false, calendarId: "primary", recurrence: "FREQ=WEEKLY;BYDAY=SA;UNTIL=20260801T045959Z" } }
  2) { type: "CREATE", event: { title: "Work", start: "2026-06-02T13:00:00-05:00", end: "2026-06-02T17:00:00-05:00", allDay: false, calendarId: "primary", recurrence: "FREQ=WEEKLY;BYDAY=TU;UNTIL=20260801T045959Z" } }
Reply lists each series: "Created 2 recurring Work series — Saturdays 3-7pm and Tuesdays 1-5pm — through Jul 31, 2026."
`.trim();

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    message: string;
    images?: string[];
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

  // Build user message — vision-capable when images are attached
  type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'auto' } };
  const userContent: string | ContentPart[] = (body.images?.length)
    ? [
        ...(body.message ? [{ type: 'text' as const, text: body.message }] : []),
        ...body.images.map(url => ({ type: 'image_url' as const, image_url: { url, detail: 'auto' as const } })),
      ]
    : body.message;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT(today, tz, eventsJSON) },
        ...historyMessages,
        { role: 'user', content: userContent },
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
