# Assistant Widget — Design Spec

**Date:** 2026-05-15
**Branch:** to be created
**Status:** Approved, pending implementation plan

## Goal

Add a persistent floating AI assistant widget to SyllaScan that lets users create, edit, move, and delete calendar events through voice or text — with zero friction. Any input format (speech, text, file drop) should work. No document upload required.

## Decisions

| # | Topic | Choice |
|---|-------|--------|
| 1 | Widget placement | Persistent floating pill, bottom-right, all pages (root layout) |
| 2 | History persistence | Supabase `conversations` table, one row per user |
| 3 | Voice transcription | OpenAI Whisper via `/api/voice/transcribe` |
| 4 | Event confirmation | Batch confirm card inline in thread (not a modal) |
| 5 | File upload | `+` button in widget input bar → existing extraction pipeline |
| 6 | AI operations | CREATE, EDIT, MOVE, DELETE via structured actions |
| 7 | History window | Last 20 messages passed as context to AI |
| 8 | Styling | `liquid-glass` dark translucent, draggable |

## Architecture

```
Floating Widget (root layout.tsx — renders on every page)
  ├── Collapsed: pill button (bottom-right, above existing FAB)
  └── Expanded: conversation thread + input bar
        ↓
/api/voice/transcribe   (new)
  └── Audio blob → OpenAI Whisper → transcript text

/api/assistant          (new, replaces fragmented /api/chat + /api/nlp-parse)
  ├── Input:  { message, history: Message[], calendarEvents: GCalEvent[] }
  ├── Model:  gpt-4o with JSON response_format
  └── Output: { reply: string, actions: AssistantAction[] }

Supabase conversations table
  └── One row per user, messages JSONB array

Existing calendar mutation hooks
  └── useCreateEvent / useUpdateEvent / useDeleteEvent fire on confirm
```

## Components

### FloatingWidget (`src/components/assistant/FloatingWidget.tsx`)
Root-level component added to `src/app/layout.tsx`. Manages open/closed state, drag position (localStorage), and renders either the pill or the expanded panel.

### ConversationThread (`src/components/assistant/ConversationThread.tsx`)
Scrollable message list. Renders:
- User messages (text or transcription)
- AI reply text
- BatchConfirmCard when actions are present

### BatchConfirmCard (`src/components/assistant/BatchConfirmCard.tsx`)
Appears inline in thread when AI returns actions. Shows each event as an editable card (title, date, time inline-editable). Buttons: [Confirm All] [Dismiss]. On confirm, fires the appropriate calendar mutation hooks.

### InputBar (`src/components/assistant/InputBar.tsx`)
Bottom bar of the expanded widget:
- `+` button: file picker → existing `/api/upload` extraction pipeline → events go to BatchConfirmCard directly (no AI step needed)
- Text input: "Ask anything..."
- Mic button: hold to record, release fires `/api/voice/transcribe`, result fills input and auto-submits
- Send button

### AssistantProvider (`src/components/assistant/AssistantProvider.tsx`)
React context. Manages:
- Conversation history (loaded from Supabase on mount, appended on each exchange)
- Pending actions state
- Loading / recording state

## API Routes

### POST `/api/voice/transcribe`
```
Body: FormData { audio: Blob (webm/wav, max 25MB) }
Returns: { transcript: string }
```
Pipes to `openai.audio.transcriptions.create({ model: 'whisper-1', file })`.
Auth required. Returns 400 if file > 25MB with message "Recording too long (max 2 min)".

### POST `/api/assistant`
```
Body: {
  message: string,
  history: Array<{ role: 'user'|'assistant', content: string }>,  // last 20
  calendarEvents: GCalEvent[]  // currently loaded events for context
}
Returns: {
  reply: string,
  actions: AssistantAction[]
}
```

`AssistantAction` type:
```typescript
type AssistantAction =
  | { type: 'CREATE'; event: EventEditorValues }
  | { type: 'EDIT';   eventId: string; calendarId: string; changes: Partial<EventEditorValues> }
  | { type: 'MOVE';   eventId: string; calendarId: string; newStart: string; newEnd: string }
  | { type: 'DELETE'; eventId: string; calendarId: string }
```

System prompt includes today's date, user's timezone, and the current calendar events list so the AI can resolve references like "that gym event" or "tomorrow's meeting."

## Supabase Schema

```sql
create table conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null unique,
  messages   jsonb not null default '[]',
  updated_at timestamptz default now()
);

alter table conversations enable row level security;

create policy "users manage own conversation"
  on conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

`messages` array item shape:
```typescript
{
  role: 'user' | 'assistant',
  content: string,
  actions?: AssistantAction[],   // present on assistant messages that had actions
  confirmed?: boolean,           // true after user taps Confirm All
  timestamp: string              // ISO
}
```

Messages are appended on each exchange. No hard limit on array size in v1 — only the last 20 are sent to the AI.

## Widget UI Layout

**Collapsed state:** Small `liquid-glass` pill, bottom-right corner, above the existing `+` FAB. Shows calendar + sparkle icon.

**Expanded state:**
```
┌─────────────────────────────────────────┐  ← draggable header
│  ✕  SyllaScan Assistant                 │
├─────────────────────────────────────────┤
│  Conversation thread (scrollable)       │
│                                         │
│  You: meeting with Hugo tmrw 6pm        │
│  AI: Got it — here's what I'll add:     │
│  ┌────────────────────────────────┐     │
│  │ 📅 Meeting with Hugo           │     │
│  │ Tomorrow · 6:00 – 7:00 PM      │     │
│  │  [Edit]        [Add ✓]         │     │
│  └────────────────────────────────┘     │
├─────────────────────────────────────────┤
│  Ask anything...                        │
│  [+]                        [🎤] [→]   │
└─────────────────────────────────────────┘
```

- Width: `380px` (desktop), full-width on mobile
- Default position: bottom-right, `20px` from edges
- Drag position persisted in `localStorage['assistant.position']`
- History loads on expand, not on page load (lazy)
- `liquid-glass` backdrop-filter blur background

## Error Handling

| Scenario | Behavior |
|---|---|
| Whisper fails / mic permission denied | Mic button shows error state, text input still works |
| AI can't parse intent | Reply: "I didn't catch that — try rephrasing" |
| Calendar mutation fails after confirm | Error toast, confirm card stays visible for retry |
| User offline | Input disabled, offline pill shown |
| Supabase history load fails | Widget opens with empty history, works for the session |
| Audio > 2 min / 25MB | Warning: "Recording too long (max 2 min)", truncated |

## File Upload via Widget `+` Button

Clicking `+` opens a file picker (same types as Upload tab: PDF, images, Word, etc.). File is sent to the existing `/api/upload` extraction pipeline. Extracted events are returned as an `AssistantAction[]` of type `CREATE` and shown in a `BatchConfirmCard` in the thread — no AI step needed since the extraction already ran.

## Non-Goals (v1)

- Cross-device history sync display (data is in Supabase but no "history page" UI)
- Voice confirmation ("confirm" spoken out loud triggers confirm)
- Recurring event creation via voice
- Reminders / notifications
- Searching existing events by voice

## Dependencies

No new npm packages required. Uses:
- `openai` (already installed) — Whisper + chat completions
- `@supabase/supabase-js` (already installed) — conversations table
- Existing calendar hooks for mutations
- Existing `/api/upload` for file extraction
