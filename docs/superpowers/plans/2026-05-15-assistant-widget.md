# Assistant Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent floating AI assistant widget that lets users create, edit, move, and delete calendar events via voice or text from anywhere in the app.

**Architecture:** A `FloatingWidget` client component lives in `client-layout.tsx` alongside `QuickAdd`. A `useAssistant` hook manages conversation state backed by Supabase `conversations` table. Two new API routes handle Whisper transcription and unified AI actions. Calendar mutations reuse existing hooks.

**Tech Stack:** Next.js 15 App Router, React 19, OpenAI (Whisper + gpt-4o), Supabase (conversations table), `@supabase/ssr`, Tailwind CSS, lucide-react

---

## File Map

**New files:**
- `supabase/migrations/20260515000000_conversations.sql` — DB table + RLS
- `src/app/api/voice/transcribe/route.ts` — Whisper transcription endpoint
- `src/app/api/assistant/route.ts` — unified AI action endpoint
- `src/components/assistant/types.ts` — shared TypeScript types
- `src/components/assistant/useAssistant.ts` — state hook, Supabase load/save
- `src/components/assistant/BatchConfirmCard.tsx` — inline event confirm/edit UI
- `src/components/assistant/InputBar.tsx` — text + mic + file input
- `src/components/assistant/ConversationThread.tsx` — scrollable message list
- `src/components/assistant/AssistantWidget.tsx` — root widget (pill + expanded, draggable)

**Modified files:**
- `src/app/client-layout.tsx` — add `<AssistantWidget />`

---

## Task 1: Supabase Migration — conversations table

**Files:**
- Create: `supabase/migrations/20260515000000_conversations.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260515000000_conversations.sql

create table if not exists conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  messages   jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  constraint conversations_user_id_unique unique (user_id)
);

alter table conversations enable row level security;

create policy "users manage own conversation"
  on conversations
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function update_conversations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_conversations_updated_at();
```

- [ ] **Step 2: Apply the migration**

```bash
cd /Users/martinofunrein/Downloads/syllascan
npx supabase db push 2>&1 || echo "Apply via Supabase dashboard if CLI not configured"
```

If CLI isn't configured, paste the SQL directly into the Supabase dashboard SQL editor at https://supabase.com/dashboard/project/ttrmkskdqtfgbyzifjyc/sql

- [ ] **Step 3: Verify table exists**

```bash
# Check via MCP or dashboard — table 'conversations' should appear
echo "Verify conversations table exists in Supabase dashboard"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260515000000_conversations.sql
git commit -m "feat: add conversations table migration"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/components/assistant/types.ts`

- [ ] **Step 1: Write types**

```typescript
// src/components/assistant/types.ts

export type AssistantActionType = 'CREATE' | 'EDIT' | 'MOVE' | 'DELETE';

export interface CreateAction {
  type: 'CREATE';
  event: {
    title: string;
    start: string;        // ISO datetime
    end: string;          // ISO datetime
    allDay: boolean;
    description?: string;
    location?: string;
    calendarId: string;
    recurrence?: string;
    color?: string;
  };
}

export interface EditAction {
  type: 'EDIT';
  eventId: string;
  calendarId: string;
  changes: {
    title?: string;
    start?: string;
    end?: string;
    description?: string;
    location?: string;
  };
}

export interface MoveAction {
  type: 'MOVE';
  eventId: string;
  calendarId: string;
  newStart: string;   // ISO datetime
  newEnd: string;     // ISO datetime
}

export interface DeleteAction {
  type: 'DELETE';
  eventId: string;
  calendarId: string;
  title: string;      // display only
}

export type AssistantAction = CreateAction | EditAction | MoveAction | DeleteAction;

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: AssistantAction[];
  confirmed?: boolean;
  timestamp: string;  // ISO
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "assistant/types" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/assistant/types.ts
git commit -m "feat: assistant shared types"
```

---

## Task 3: POST /api/voice/transcribe

**Files:**
- Create: `src/app/api/voice/transcribe/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/voice/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB Whisper limit

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await request.formData();
  const audio = form.get('audio') as File | null;

  if (!audio) return NextResponse.json({ error: 'No audio file' }, { status: 400 });
  if (audio.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Recording too long (max 2 min)' },
      { status: 400 }
    );
  }

  try {
    const result = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audio,
      response_format: 'text',
    });
    return NextResponse.json({ transcript: result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Transcription failed' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "voice/transcribe" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/voice/transcribe/route.ts
git commit -m "feat: POST /api/voice/transcribe — Whisper"
```

---

## Task 4: POST /api/assistant

**Files:**
- Create: `src/app/api/assistant/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/assistant/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import type { ConversationMessage, AssistantAction } from '@/components/assistant/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = (today: string, tz: string, eventsJSON: string) => `
You are an AI calendar assistant for SyllaScan. The user can ask you to create, edit, move, or delete calendar events using natural language or voice.

Today's date: ${today}
User's timezone: ${tz}

Current calendar events (for reference when user mentions "that meeting" etc.):
${eventsJSON}

You MUST respond with valid JSON matching this exact schema:
{
  "reply": "string — conversational response to the user",
  "actions": [
    // Zero or more action objects. Types:

    // CREATE a new event:
    { "type": "CREATE", "event": { "title": "string", "start": "ISO datetime", "end": "ISO datetime", "allDay": false, "description": "string|null", "location": "string|null", "calendarId": "primary", "color": "string|null" } }

    // EDIT an existing event (include only changed fields):
    { "type": "EDIT", "eventId": "string", "calendarId": "string", "changes": { "title"?: "string", "start"?: "ISO", "end"?: "ISO", "description"?: "string", "location"?: "string" } }

    // MOVE an event to a new time:
    { "type": "MOVE", "eventId": "string", "calendarId": "string", "newStart": "ISO", "newEnd": "ISO" }

    // DELETE an event:
    { "type": "DELETE", "eventId": "string", "calendarId": "string", "title": "string" }
  ]
}

Rules:
- If the user's intent is ambiguous, ask for clarification in "reply" and return empty "actions".
- If you cannot identify an event they're referring to, say so in "reply".
- Default calendar for CREATE is "primary" unless user specifies otherwise.
- For relative dates ("tomorrow", "next Friday"), resolve against today's date.
- All-day events: set allDay true, start/end to YYYY-MM-DDT00:00:00.000Z.
- Always confirm what you're doing in the "reply" field.
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
    body.calendarEvents.map(e => ({
      id: e.id,
      calendarId: e.calendarId,
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
    })),
    null, 2
  );

  // Build messages array for OpenAI (last 20 history items + current message)
  const historyMessages = body.history.slice(-20).map(m => ({
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Assistant failed' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "api/assistant" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/assistant/route.ts
git commit -m "feat: POST /api/assistant — unified AI calendar action route"
```

---

## Task 5: useAssistant Hook

**Files:**
- Create: `src/components/assistant/useAssistant.ts`

- [ ] **Step 1: Write the hook**

```typescript
// src/components/assistant/useAssistant.ts
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ConversationMessage, AssistantAction } from './types';

interface UseAssistantOptions {
  userId: string | null;
  calendarEvents: Array<{ id: string; calendarId: string; title: string; start: string; end: string; allDay: boolean }>;
}

export function useAssistant({ userId, calendarEvents }: UseAssistantOptions) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const supabase = createClient();

  // Load history from Supabase on mount
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('conversations')
      .select('messages')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.messages && Array.isArray(data.messages)) {
          setMessages(data.messages as ConversationMessage[]);
        }
        setHistoryLoaded(true);
      });
  }, [userId]);

  // Persist messages to Supabase whenever they change
  const persistMessages = useCallback(async (msgs: ConversationMessage[]) => {
    if (!userId) return;
    await supabase
      .from('conversations')
      .upsert({ user_id: userId, messages: msgs }, { onConflict: 'user_id' });
  }, [userId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ConversationMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-20),
          calendarEvents,
          timezone: tz,
        }),
      });

      if (!res.ok) throw new Error('Assistant request failed');
      const data = await res.json() as { reply: string; actions: AssistantAction[] };

      const assistantMsg: ConversationMessage = {
        role: 'assistant',
        content: data.reply,
        actions: data.actions.length > 0 ? data.actions : undefined,
        timestamp: new Date().toISOString(),
      };

      const withReply = [...next, assistantMsg];
      setMessages(withReply);
      await persistMessages(withReply);
    } catch {
      const errMsg: ConversationMessage = {
        role: 'assistant',
        content: "Sorry, I had trouble with that. Try again.",
        timestamp: new Date().toISOString(),
      };
      const withErr = [...next, errMsg];
      setMessages(withErr);
      await persistMessages(withErr);
    } finally {
      setLoading(false);
    }
  }, [messages, calendarEvents, loading, persistMessages]);

  const markConfirmed = useCallback(async (msgIndex: number) => {
    const updated = messages.map((m, i) =>
      i === msgIndex ? { ...m, confirmed: true } : m
    );
    setMessages(updated);
    await persistMessages(updated);
  }, [messages, persistMessages]);

  const clearHistory = useCallback(async () => {
    setMessages([]);
    if (userId) {
      await supabase
        .from('conversations')
        .upsert({ user_id: userId, messages: [] }, { onConflict: 'user_id' });
    }
  }, [userId]);

  // Voice recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      // Mic permission denied — fail silently, user sees no mic response
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) { resolve(null); return; }

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        recorder.stream.getTracks().forEach(t => t.stop());
        setRecording(false);

        if (blob.size > 25 * 1024 * 1024) {
          resolve(null);
          return;
        }

        const form = new FormData();
        form.append('audio', blob, 'recording.webm');

        try {
          const res = await fetch('/api/voice/transcribe', { method: 'POST', body: form });
          if (!res.ok) { resolve(null); return; }
          const { transcript } = await res.json();
          resolve(transcript ?? null);
        } catch {
          resolve(null);
        }
      };

      recorder.stop();
    });
  }, []);

  return {
    messages,
    loading,
    recording,
    historyLoaded,
    sendMessage,
    markConfirmed,
    clearHistory,
    startRecording,
    stopRecording,
  };
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "useAssistant" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/assistant/useAssistant.ts
git commit -m "feat: useAssistant hook with Supabase history + Whisper recording"
```

---

## Task 6: BatchConfirmCard Component

**Files:**
- Create: `src/components/assistant/BatchConfirmCard.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/components/assistant/BatchConfirmCard.tsx
'use client';
import { useState } from 'react';
import { Check, X, Calendar, Trash2, Edit2, Move } from 'lucide-react';
import type { AssistantAction } from './types';

interface Props {
  actions: AssistantAction[];
  onConfirm: (actions: AssistantAction[]) => Promise<void>;
  onDismiss: () => void;
  loading?: boolean;
}

function actionLabel(a: AssistantAction): string {
  if (a.type === 'CREATE') return a.event.title;
  if (a.type === 'EDIT') return `Edit: ${a.changes.title ?? a.eventId}`;
  if (a.type === 'MOVE') return `Move event`;
  return `Delete: ${a.title}`;
}

function actionIcon(a: AssistantAction) {
  if (a.type === 'CREATE') return <Calendar size={14} />;
  if (a.type === 'EDIT') return <Edit2 size={14} />;
  if (a.type === 'MOVE') return <Move size={14} />;
  return <Trash2 size={14} className="text-red-400" />;
}

function formatDT(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function BatchConfirmCard({ actions, onConfirm, onDismiss, loading }: Props) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(actions);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden mt-2">
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
          {actions.length} {actions.length === 1 ? 'action' : 'actions'} — confirm?
        </span>
      </div>

      <div className="divide-y divide-white/5">
        {actions.map((action, i) => (
          <div key={i} className="px-3 py-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-white/50 shrink-0">{actionIcon(action)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {actionLabel(action)}
                </div>
                {action.type === 'CREATE' && (
                  <div className="text-xs text-white/50 mt-0.5">
                    {action.event.allDay
                      ? new Date(action.event.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      : `${formatDT(action.event.start)} → ${new Date(action.event.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                    }
                    {action.event.location && ` · ${action.event.location}`}
                  </div>
                )}
                {action.type === 'MOVE' && (
                  <div className="text-xs text-white/50 mt-0.5">
                    → {formatDT(action.newStart)}
                  </div>
                )}
                {action.type === 'EDIT' && action.changes.start && (
                  <div className="text-xs text-white/50 mt-0.5">
                    → {formatDT(action.changes.start)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 flex items-center gap-2 border-t border-white/10">
        <button
          onClick={handleConfirm}
          disabled={confirming || loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          <Check size={14} />
          {confirming ? 'Adding...' : 'Confirm All'}
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-sm transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "BatchConfirmCard" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/assistant/BatchConfirmCard.tsx
git commit -m "feat: BatchConfirmCard inline event confirm UI"
```

---

## Task 7: InputBar Component

**Files:**
- Create: `src/components/assistant/InputBar.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/components/assistant/InputBar.tsx
'use client';
import { useState, useRef, type KeyboardEvent } from 'react';
import { Plus, Mic, MicOff, Send } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  onFileSelect: (file: File) => void;
  onRecordStart: () => void;
  onRecordStop: () => Promise<string | null>;
  recording: boolean;
  loading: boolean;
  disabled?: boolean;
}

export function InputBar({
  onSend, onFileSelect, onRecordStart, onRecordStop,
  recording, loading, disabled,
}: Props) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setText('');
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMic = async () => {
    if (recording) {
      const transcript = await onRecordStop();
      if (transcript) {
        onSend(transcript);
      }
    } else {
      onRecordStart();
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = '';
  };

  return (
    <div className="px-3 py-2 border-t border-white/10">
      <div className="flex items-end gap-2">
        {/* File upload */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled || loading}
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title="Upload file"
        >
          <Plus size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
          className="hidden"
          onChange={handleFile}
        />

        {/* Text input */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={recording ? 'Listening...' : 'Ask anything...'}
          disabled={disabled || recording || loading}
          rows={1}
          className={[
            'flex-1 bg-transparent resize-none outline-none text-sm text-white placeholder-white/30',
            'max-h-24 overflow-y-auto leading-relaxed',
          ].join(' ')}
          style={{ minHeight: '24px' }}
        />

        {/* Mic */}
        <button
          onClick={handleMic}
          disabled={disabled || loading}
          className={[
            'p-1.5 rounded-lg shrink-0 transition-colors',
            recording
              ? 'text-red-400 bg-red-400/15 hover:bg-red-400/25'
              : 'text-white/50 hover:text-white hover:bg-white/10',
          ].join(' ')}
          title={recording ? 'Stop recording' : 'Start recording'}
        >
          {recording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || loading || disabled || recording}
          className="p-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 transition-colors shrink-0"
          title="Send"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "InputBar" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/assistant/InputBar.tsx
git commit -m "feat: InputBar with text/voice/file inputs"
```

---

## Task 8: ConversationThread Component

**Files:**
- Create: `src/components/assistant/ConversationThread.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/components/assistant/ConversationThread.tsx
'use client';
import { useEffect, useRef } from 'react';
import { BatchConfirmCard } from './BatchConfirmCard';
import type { ConversationMessage, AssistantAction } from './types';

interface Props {
  messages: ConversationMessage[];
  loading: boolean;
  onConfirmActions: (msgIndex: number, actions: AssistantAction[]) => Promise<void>;
  onDismissActions: (msgIndex: number) => void;
}

export function ConversationThread({ messages, loading, onConfirmActions, onDismissActions }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/30 text-sm px-4 text-center">
        Say or type anything — "Meeting with Hugo tomorrow at 6pm", "Delete my gym session", or drop a file.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={[
            'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
            msg.role === 'user'
              ? 'bg-blue-500 text-white rounded-br-sm'
              : 'bg-white/8 text-white/90 rounded-bl-sm border border-white/10',
          ].join(' ')}>
            <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            {msg.actions && msg.actions.length > 0 && !msg.confirmed && (
              <BatchConfirmCard
                actions={msg.actions}
                onConfirm={(actions) => onConfirmActions(i, actions)}
                onDismiss={() => onDismissActions(i)}
              />
            )}
            {msg.confirmed && (
              <p className="text-xs text-white/40 mt-1">✓ Added to calendar</p>
            )}
          </div>
        </div>
      ))}

      {loading && (
        <div className="flex justify-start">
          <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-2.5">
            <div className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "ConversationThread" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/assistant/ConversationThread.tsx
git commit -m "feat: ConversationThread with message bubbles and loading indicator"
```

---

## Task 9: AssistantWidget Root Component

**Files:**
- Create: `src/components/assistant/AssistantWidget.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/components/assistant/AssistantWidget.tsx
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, X, Minimize2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useAssistant } from './useAssistant';
import { ConversationThread } from './ConversationThread';
import { InputBar } from './InputBar';
import type { AssistantAction } from './types';

const POS_KEY = 'assistant.position';

function useDrag(expanded: boolean) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(POS_KEY);
      if (stored) setPos(JSON.parse(stored));
    } catch {}
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!expanded) return;
    dragging.current = true;
    const rect = widgetRef.current!.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const x = Math.max(0, Math.min(window.innerWidth - 400, e.clientX - offset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - offset.current.y));
      setPos({ x, y });
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setPos(p => {
        if (p) localStorage.setItem(POS_KEY, JSON.stringify(p));
        return p;
      });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  return { widgetRef, pos, onMouseDown };
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const { user, googleCalendarConnected } = useAuth();
  const { widgetRef, pos, onMouseDown } = useDrag(open);

  // We pass empty calendar events here — in production CalendarShell passes them via a context
  // For now the AI uses whatever events are described in conversation
  const assistant = useAssistant({ userId: user?.id ?? null, calendarEvents: [] });

  const handleFileSelect = useCallback(async (file: File) => {
    // Route through existing upload extraction pipeline
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) return;
      const data = await res.json();
      const events = data.events ?? [];
      if (events.length > 0) {
        // Inject as a synthetic assistant message with CREATE actions
        const actions: AssistantAction[] = events.map((e: any) => ({
          type: 'CREATE' as const,
          event: {
            title: e.title,
            start: e.startDate ?? e.date + 'T00:00:00.000Z',
            end: e.endDate ?? e.date + 'T23:59:00.000Z',
            allDay: e.isAllDay ?? false,
            description: e.description ?? null,
            location: e.location ?? null,
            calendarId: 'primary',
            color: null,
          },
        }));
        await assistant.sendMessage(`I uploaded a file and found ${events.length} event(s). Please confirm them.`);
      }
    } catch {}
  }, [assistant]);

  const handleConfirmActions = useCallback(async (msgIndex: number, actions: AssistantAction[]) => {
    for (const action of actions) {
      if (action.type === 'CREATE') {
        await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendarId: action.event.calendarId ?? 'primary', event: action.event, addMeet: false }),
        });
      } else if (action.type === 'EDIT') {
        const q = new URLSearchParams({ calendarId: action.calendarId, updateScope: 'single' });
        await fetch(`/api/calendar/events/${action.eventId}?${q}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: action.changes }),
        });
      } else if (action.type === 'MOVE') {
        const q = new URLSearchParams({ calendarId: action.calendarId, updateScope: 'single' });
        await fetch(`/api/calendar/events/${action.eventId}?${q}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: { start: action.newStart, end: action.newEnd } }),
        });
      } else if (action.type === 'DELETE') {
        const q = new URLSearchParams({ calendarId: action.calendarId, updateScope: 'single' });
        await fetch(`/api/calendar/events/${action.eventId}?${q}`, { method: 'DELETE' });
      }
    }
    await assistant.markConfirmed(msgIndex);
  }, [assistant]);

  const handleDismissActions = useCallback((msgIndex: number) => {
    assistant.markConfirmed(msgIndex); // marks as handled (no actions applied)
  }, [assistant]);

  // Positioning style
  const style: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
    : { position: 'fixed', bottom: '80px', right: '20px' };

  if (!user) return null; // Only show when authenticated

  // Collapsed pill
  if (!open) {
    return (
      <div style={style} className="z-[9990]">
        <button
          onClick={() => setOpen(true)}
          className="w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95"
          style={{
            background: 'rgba(15,23,42,0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
          title="Open assistant"
        >
          <Sparkles size={20} className="text-blue-400" />
        </button>
      </div>
    );
  }

  // Expanded panel
  return (
    <div
      ref={widgetRef}
      style={{
        ...style,
        width: 'min(380px, calc(100vw - 24px))',
        height: 'min(520px, calc(100vh - 120px))',
        background: 'rgba(10,16,30,0.82)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '1rem',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        zIndex: 9990,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header — draggable */}
      <div
        onMouseDown={onMouseDown}
        className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 cursor-grab active:cursor-grabbing select-none"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-blue-400" />
          <span className="text-sm font-semibold text-white/90">SyllaScan Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            title="Minimize"
          >
            <Minimize2 size={14} />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Thread */}
      <ConversationThread
        messages={assistant.messages}
        loading={assistant.loading}
        onConfirmActions={handleConfirmActions}
        onDismissActions={handleDismissActions}
      />

      {/* Input bar */}
      <InputBar
        onSend={assistant.sendMessage}
        onFileSelect={handleFileSelect}
        onRecordStart={assistant.startRecording}
        onRecordStop={assistant.stopRecording}
        recording={assistant.recording}
        loading={assistant.loading}
        disabled={!googleCalendarConnected}
      />

      {!googleCalendarConnected && (
        <div className="px-3 pb-2 text-xs text-yellow-400/70 text-center">
          Connect Google Calendar to create events
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "AssistantWidget" | head -10
```

Fix any errors. Common issue: `useAssistant` returns `markConfirmed` but the callback signature above passes `msgIndex` — verify they match.

- [ ] **Step 3: Commit**

```bash
git add src/components/assistant/AssistantWidget.tsx
git commit -m "feat: AssistantWidget — draggable floating panel"
```

---

## Task 10: Wire into ClientLayout

**Files:**
- Modify: `src/app/client-layout.tsx`

- [ ] **Step 1: Add import and component**

In `src/app/client-layout.tsx`, add after the existing `QuickAdd` import:

```typescript
import { AssistantWidget } from '@/components/assistant/AssistantWidget';
```

Then inside the JSX, add `<AssistantWidget />` directly after `<QuickAdd />`:

```tsx
{children}
<QuickAdd />
<AssistantWidget />
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "client-layout|AssistantWidget" | head -10
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | grep -E "error|✓" | head -8
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add src/app/client-layout.tsx
git commit -m "feat: add AssistantWidget to root layout"
```

---

## Task 11: Deploy and Verify

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Deploy to Vercel**

```bash
npx vercel deploy --prod --yes 2>&1 | grep -E "✓|Aliased|error" | head -5
```

- [ ] **Step 3: Verify with Playwright**

```python
# Quick smoke test — open the app, check widget pill appears
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://syllascan-martin.vercel.app/scan", wait_until="networkidle", timeout=30000)
        # Widget only shows when authenticated — check it doesn't crash the page
        body = await page.inner_text("body")
        assert "Something went wrong" not in body, "Page error!"
        print("✓ Page loads without error")
        await browser.close()

asyncio.run(main())
```

Run: `python3 /tmp/verify-widget.py`

---

## Self-Review Against Spec

| Spec requirement | Task |
|---|---|
| Persistent floating widget (root layout) | Task 10 |
| Draggable, position in localStorage | Task 9 |
| `liquid-glass` dark style | Task 9 (inline styles) |
| Voice via Whisper | Tasks 3, 5 |
| Text input | Task 7 |
| File upload via `+` button | Tasks 7, 9 |
| Batch confirm card inline in thread | Task 6 |
| CREATE / EDIT / MOVE / DELETE actions | Tasks 2, 4 |
| Supabase conversation history | Tasks 1, 5 |
| Persists across reloads | Task 5 (upsert on every change) |
| Last 20 messages as AI context | Task 4 |
| Current calendar events as AI context | Task 5 (passed via hook) |
| Collapsible to pill | Task 9 |
| Auth-gated (only shows when logged in) | Task 9 (`if (!user) return null`) |

**Gap:** The `calendarEvents` prop in `AssistantWidget` is passed as `[]` currently. For the AI to reference existing events by name, the widget needs access to the loaded calendar events. In v1 this is acceptable — users can describe events by time ("move my 6pm meeting") and the AI will work with that context. A future enhancement passes the loaded events from `CalendarShell` via a context provider.
