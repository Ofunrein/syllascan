# Google Calendar UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Live + Embedded calendar views with a single Google Calendar-style interactive calendar at `/calendar` using `schedule-x`, React Query, full CRUD, drag/resize, multi-calendar, optimistic updates, and undo toasts.

**Architecture:** New route `/calendar` renders `CalendarShell` which wraps a schedule-x `CalendarGrid`. React Query manages server state with optimistic mutations. Five new API route files handle CRUD; token refresh logic lives in `src/lib/google/calendar.ts`.

**Tech Stack:** Next.js 15 App Router, React 19, `@schedule-x/react@^2`, `@tanstack/react-query@^5`, `rrule@^2`, Tailwind CSS, Supabase (token storage), `googleapis`

---

## File Map

**New files:**
- `src/lib/google/calendar.ts` — shared auth client + token refresh
- `src/app/api/calendar/calendars/route.ts` — GET calendar list
- `src/app/api/calendar/events/[id]/route.ts` — PATCH + DELETE
- `src/components/calendar/QueryProvider.tsx` — React Query `QueryClientProvider`
- `src/components/calendar/CalendarShell.tsx` — layout, toolbar, sidebar toggle, keyboard shortcut
- `src/components/calendar/Sidebar.tsx` — Create button, calendar list toggles
- `src/components/calendar/MiniMonth.tsx` — small month picker synced to main view
- `src/components/calendar/CalendarGrid.tsx` — schedule-x instance + event bridge
- `src/components/calendar/YearView.tsx` — custom 12-month year grid
- `src/components/calendar/EventPopover.tsx` — click-chip popover
- `src/components/calendar/EventEditorModal.tsx` — full event editor modal
- `src/components/calendar/RecurrenceBuilder.tsx` — RRULE preset builder
- `src/components/calendar/GuestsInput.tsx` — email chip input
- `src/components/calendar/UndoToast.tsx` — 6s undo toast
- `src/components/calendar/RecurrencePrompt.tsx` — This/Following/All dialog
- `src/components/calendar/hooks/useCalendars.ts` — React Query hook
- `src/components/calendar/hooks/useEvents.ts` — React Query hook + mutations
- `src/components/calendar/types.ts` — shared TypeScript types

**Modified files:**
- `src/app/calendar/page.tsx` — replace react-big-calendar shell with new shell
- `src/app/api/calendar/events/route.ts` — add POST handler, refactor GET to multi-calendar
- `src/app/scan/page.tsx` — remove LiveCalendarView/EmbeddedCalendarView imports, replace tabs with link

**Deleted files:**
- `src/components/LiveCalendarView.tsx`
- `src/components/EmbeddedCalendarView.tsx`
- `src/app/api/calendar/embed-url/route.ts`

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install runtime packages**

```bash
cd /Users/martinofunrein/Downloads/syllascan
npm install @schedule-x/react@^2 @schedule-x/calendar@^2 @schedule-x/drag-and-drop@^2 @schedule-x/event-modal@^2 @schedule-x/theme-default@^2 @schedule-x/resize@^2 @tanstack/react-query@^5 rrule@^2
```

- [ ] **Step 2: Install type definitions**

```bash
npm install --save-dev @types/rrule
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero new errors introduced by the installs (schedule-x ships its own types).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add schedule-x, react-query, rrule dependencies"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/components/calendar/types.ts`

- [ ] **Step 1: Write types file**

```typescript
// src/components/calendar/types.ts

export type ViewMode = 'day' | 'week' | 'month' | 'year' | 'schedule';

export interface GCalCalendar {
  id: string;
  summary: string;
  backgroundColor: string;
  foregroundColor: string;
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader';
  primary?: boolean;
}

export interface GCalEvent {
  id: string;
  calendarId: string;
  calendarColor: string;
  title: string;
  start: string;       // ISO datetime or date (all-day)
  end: string;         // ISO datetime or date
  allDay: boolean;
  description?: string;
  location?: string;
  color?: string;      // event-level override hex
  recurrence?: string; // RRULE string e.g. "RRULE:FREQ=WEEKLY;BYDAY=MO"
  recurringEventId?: string; // set on instances
  htmlLink?: string;
  hangoutLink?: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
}

export type UpdateScope = 'single' | 'following' | 'all';

export interface UndoRecord {
  action: 'create' | 'update' | 'delete';
  eventId: string;
  calendarId: string;
  previousState?: Partial<GCalEvent>;
}

export interface EventEditorValues {
  title: string;
  allDay: boolean;
  start: string;       // ISO datetime
  end: string;         // ISO datetime
  description: string;
  location: string;
  color: string;
  calendarId: string;
  recurrence: string;  // RRULE string or ''
  guests: string[];    // email list
  addMeet: boolean;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/types.ts
git commit -m "feat: add calendar shared types"
```

---

## Task 3: Token Helper Library

**Files:**
- Create: `src/lib/google/calendar.ts`

- [ ] **Step 1: Create the token helper**

```typescript
// src/lib/google/calendar.ts
import { google } from 'googleapis';
import { createServiceRoleClient } from '@/lib/supabase/server';

export interface TokenBundle {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

export async function getTokensForUser(userId: string): Promise<TokenBundle | null> {
  const serviceClient = await createServiceRoleClient();
  const { data: profile } = await serviceClient
    .from('users')
    .select('google_tokens')
    .eq('id', userId)
    .single();

  const tokens = profile?.google_tokens as any;
  if (!tokens?.access_token) return null;

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expires_at ?? null,
  };
}

export async function getRefreshedClient(
  userId: string
): Promise<{ client: ReturnType<typeof google.auth.OAuth2.prototype.constructor> & { credentials: any }; reconnectRequired?: boolean } | null> {
  const tokens = await getTokensForUser(userId);
  if (!tokens) return null;

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? undefined,
    expiry_date: tokens.expiresAt ?? undefined,
  });

  const expiresSoon = tokens.expiresAt && tokens.expiresAt - Date.now() < 5 * 60 * 1000;
  if (expiresSoon && tokens.refreshToken) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      if (credentials.access_token) {
        const serviceClient = await createServiceRoleClient();
        await serviceClient.from('users').update({
          google_tokens: {
            access_token: credentials.access_token,
            refresh_token: tokens.refreshToken,
            expires_at: credentials.expiry_date ?? Date.now() + 3600000,
          },
        }).eq('id', userId);
        oauth2.setCredentials(credentials);
      }
    } catch {
      // proceed with existing token; will fail at API call if truly expired
    }
  }

  return oauth2 as any;
}

export async function handleGoogleApiError(
  error: any,
  userId: string
): Promise<{ reconnectRequired: boolean; message: string }> {
  const status = error?.code ?? error?.response?.status ?? 0;
  const msg: string = error?.message ?? '';

  if (status === 401 || msg.toLowerCase().includes('invalid_grant')) {
    const serviceClient = await createServiceRoleClient();
    await serviceClient.from('users').update({ google_calendar_connected: false }).eq('id', userId);
    return { reconnectRequired: true, message: 'Google Calendar disconnected. Please reconnect.' };
  }
  if (status === 403 && (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('permission'))) {
    return { reconnectRequired: true, message: 'Missing calendar permission. Please reconnect.' };
  }
  return { reconnectRequired: false, message: msg || 'Google Calendar API error.' };
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "google/calendar" | head -10
```

Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/google/calendar.ts
git commit -m "feat: extract Google Calendar token helper to lib"
```

---

## Task 4: API Routes — Calendars List + Events CRUD

**Files:**
- Create: `src/app/api/calendar/calendars/route.ts`
- Create: `src/app/api/calendar/events/[id]/route.ts`
- Modify: `src/app/api/calendar/events/route.ts`

- [ ] **Step 1: Create GET /api/calendar/calendars**

```typescript
// src/app/api/calendar/calendars/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getRefreshedClient, handleGoogleApiError } from '@/lib/google/calendar';
import { google } from 'googleapis';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await getRefreshedClient(user.id);
  if (!auth) return NextResponse.json({ reconnectRequired: true }, { status: 401 });

  try {
    const cal = google.calendar({ version: 'v3', auth });
    const res = await cal.calendarList.list({ minAccessRole: 'freeBusyReader' });
    const items = (res.data.items ?? []).map(c => ({
      id: c.id,
      summary: c.summary,
      backgroundColor: c.backgroundColor ?? '#3b82f6',
      foregroundColor: c.foregroundColor ?? '#ffffff',
      accessRole: c.accessRole,
      primary: c.primary ?? false,
    }));
    return NextResponse.json({ calendars: items });
  } catch (err: any) {
    const { reconnectRequired, message } = await handleGoogleApiError(err, user.id);
    return NextResponse.json({ error: message, reconnectRequired }, { status: reconnectRequired ? 401 : 500 });
  }
}
```

- [ ] **Step 2: Add POST to existing events route**

Open `src/app/api/calendar/events/route.ts`. Add after the existing GET export:

```typescript
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await getRefreshedClient(user.id);
  if (!auth) return NextResponse.json({ reconnectRequired: true }, { status: 401 });

  const body = await request.json();
  const { calendarId = 'primary', event: eventBody, addMeet } = body;

  const resource: any = {
    summary: eventBody.title,
    description: eventBody.description,
    location: eventBody.location,
    start: eventBody.allDay
      ? { date: eventBody.start.split('T')[0] }
      : { dateTime: eventBody.start, timeZone: 'UTC' },
    end: eventBody.allDay
      ? { date: eventBody.end.split('T')[0] }
      : { dateTime: eventBody.end, timeZone: 'UTC' },
    colorId: eventBody.colorId,
    recurrence: eventBody.recurrence ? [eventBody.recurrence] : undefined,
    attendees: eventBody.guests?.map((email: string) => ({ email })),
  };

  if (addMeet) {
    resource.conferenceData = {
      createRequest: { requestId: Math.random().toString(36).slice(2) },
    };
  }

  try {
    const { google } = await import('googleapis');
    const cal = google.calendar({ version: 'v3', auth });
    const res = await cal.events.insert({
      calendarId,
      requestBody: resource,
      conferenceDataVersion: addMeet ? 1 : 0,
    });
    return NextResponse.json({ event: res.data });
  } catch (err: any) {
    const { reconnectRequired, message } = await handleGoogleApiError(err, user.id);
    return NextResponse.json({ error: message, reconnectRequired }, { status: reconnectRequired ? 401 : 500 });
  }
}
```

Also update the top-level imports in `events/route.ts` to import from `@/lib/google/calendar`:

```typescript
import { getRefreshedClient, handleGoogleApiError } from '@/lib/google/calendar';
```

And simplify the GET handler to use `getRefreshedClient` instead of duplicating token refresh logic. The GET handler should also support multiple `calendarIds` (comma-separated) via query param:

```typescript
// In the GET handler, replace the token/refresh block with:
const auth = await getRefreshedClient(user.id);
if (!auth) return NextResponse.json({ reconnectRequired: true }, { status: 401 });

const { searchParams } = new URL(request.url);
const calendarIdsParam = searchParams.get('calendarIds') || 'primary';
const calendarIds = calendarIdsParam.split(',');
const timeMin = searchParams.get('timeMin') || new Date().toISOString();
const timeMax = searchParams.get('timeMax') || new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString();

const { google } = await import('googleapis');
const cal = google.calendar({ version: 'v3', auth });

const results = await Promise.all(
  calendarIds.map(calId =>
    cal.events.list({
      calendarId: calId.trim(),
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    }).then(r => ({ calId: calId.trim(), items: r.data.items ?? [] }))
  )
);

const events = results.flatMap(({ calId, items }) =>
  items.map(e => ({
    id: e.id,
    calendarId: calId,
    title: e.summary,
    description: e.description,
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    allDay: Boolean(e.start?.date && !e.start?.dateTime),
    location: e.location,
    recurrence: e.recurrence?.[0],
    recurringEventId: e.recurringEventId,
    htmlLink: e.htmlLink,
    hangoutLink: e.hangoutLink,
    attendees: e.attendees?.map(a => ({ email: a.email, displayName: a.displayName, responseStatus: a.responseStatus })),
  }))
);

return NextResponse.json({ events });
```

- [ ] **Step 3: Create PATCH + DELETE /api/calendar/events/[id]**

```typescript
// src/app/api/calendar/events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getRefreshedClient, handleGoogleApiError } from '@/lib/google/calendar';
import { google } from 'googleapis';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await getRefreshedClient(user.id);
  if (!auth) return NextResponse.json({ reconnectRequired: true }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get('calendarId') ?? 'primary';
  const updateScope = (searchParams.get('updateScope') ?? 'single') as 'single' | 'following' | 'all';

  const body = await request.json();
  const { event: eventBody } = body;

  const resource: any = {
    summary: eventBody.title,
    description: eventBody.description,
    location: eventBody.location,
    start: eventBody.allDay
      ? { date: eventBody.start.split('T')[0] }
      : { dateTime: eventBody.start, timeZone: 'UTC' },
    end: eventBody.allDay
      ? { date: eventBody.end.split('T')[0] }
      : { dateTime: eventBody.end, timeZone: 'UTC' },
    colorId: eventBody.colorId,
    recurrence: eventBody.recurrence ? [eventBody.recurrence] : undefined,
    attendees: eventBody.guests?.map((email: string) => ({ email })),
  };

  const cal = google.calendar({ version: 'v3', auth });

  try {
    if (updateScope === 'all') {
      // Patch the master recurring event (id without instance suffix)
      const masterId = id.split('_')[0];
      const res = await cal.events.patch({ calendarId, eventId: masterId, requestBody: resource });
      return NextResponse.json({ event: res.data });
    }

    if (updateScope === 'following') {
      // Set UNTIL on master, insert new series from this instance
      const instanceDate = id.split('_')[1];
      const masterRes = await cal.events.get({ calendarId, eventId: id.split('_')[0] });
      const masterRecurrence = masterRes.data.recurrence?.[0] ?? '';
      const untilDate = instanceDate ? instanceDate.replace(/T.*/, '') : '';
      const updatedRule = masterRecurrence
        ? `${masterRecurrence};UNTIL=${untilDate}`
        : masterRecurrence;

      await cal.events.patch({
        calendarId,
        eventId: id.split('_')[0],
        requestBody: { recurrence: [updatedRule] },
      });

      // Create new series from this instance
      const newRes = await cal.events.insert({ calendarId, requestBody: resource });
      return NextResponse.json({ event: newRes.data });
    }

    // Single instance update
    const res = await cal.events.patch({ calendarId, eventId: id, requestBody: resource });
    return NextResponse.json({ event: res.data });
  } catch (err: any) {
    const { reconnectRequired, message } = await handleGoogleApiError(err, user.id);
    return NextResponse.json({ error: message, reconnectRequired }, { status: reconnectRequired ? 401 : 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = await getRefreshedClient(user.id);
  if (!auth) return NextResponse.json({ reconnectRequired: true }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get('calendarId') ?? 'primary';
  const updateScope = (searchParams.get('updateScope') ?? 'single') as 'single' | 'following' | 'all';

  const cal = google.calendar({ version: 'v3', auth });

  try {
    if (updateScope === 'all') {
      await cal.events.delete({ calendarId, eventId: id.split('_')[0] });
    } else if (updateScope === 'following') {
      const instanceDate = id.split('_')[1];
      const masterRes = await cal.events.get({ calendarId, eventId: id.split('_')[0] });
      const masterRecurrence = masterRes.data.recurrence?.[0] ?? '';
      const untilDate = instanceDate ? instanceDate.replace(/T.*/, '') : '';
      const updatedRule = masterRecurrence ? `${masterRecurrence};UNTIL=${untilDate}` : masterRecurrence;
      await cal.events.patch({
        calendarId,
        eventId: id.split('_')[0],
        requestBody: { recurrence: [updatedRule] },
      });
    } else {
      await cal.events.delete({ calendarId, eventId: id });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const { reconnectRequired, message } = await handleGoogleApiError(err, user.id);
    return NextResponse.json({ error: message, reconnectRequired }, { status: reconnectRequired ? 401 : 500 });
  }
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "calendar|route" | head -20
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/calendar/calendars/ src/app/api/calendar/events/ src/lib/google/calendar.ts
git commit -m "feat: calendar API routes — calendars list, multi-calendar events, POST/PATCH/DELETE"
```

---

## Task 5: React Query Provider + Hooks

**Files:**
- Create: `src/components/calendar/QueryProvider.tsx`
- Create: `src/components/calendar/hooks/useCalendars.ts`
- Create: `src/components/calendar/hooks/useEvents.ts`

- [ ] **Step 1: Create QueryProvider**

```typescript
// src/components/calendar/QueryProvider.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function CalendarQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      })
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Create useCalendars hook**

```typescript
// src/components/calendar/hooks/useCalendars.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import type { GCalCalendar } from '../types';

async function fetchCalendars(): Promise<GCalCalendar[]> {
  const res = await fetch('/api/calendar/calendars');
  if (!res.ok) throw new Error('Failed to fetch calendars');
  const data = await res.json();
  return data.calendars ?? [];
}

export function useCalendars() {
  return useQuery({ queryKey: ['calendars'], queryFn: fetchCalendars });
}
```

- [ ] **Step 3: Create useEvents hook with mutations**

```typescript
// src/components/calendar/hooks/useEvents.ts
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GCalEvent, EventEditorValues, UpdateScope } from '../types';

interface FetchParams {
  calendarIds: string[];
  timeMin: string;
  timeMax: string;
}

async function fetchEvents(params: FetchParams): Promise<GCalEvent[]> {
  const q = new URLSearchParams({
    calendarIds: params.calendarIds.join(','),
    timeMin: params.timeMin,
    timeMax: params.timeMax,
  });
  const res = await fetch(`/api/calendar/events?${q}`);
  if (!res.ok) throw new Error('Failed to fetch events');
  const data = await res.json();
  return data.events ?? [];
}

export function useEvents(params: FetchParams) {
  return useQuery({
    queryKey: ['events', params.calendarIds, params.timeMin, params.timeMax],
    queryFn: () => fetchEvents(params),
    enabled: params.calendarIds.length > 0,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      calendarId,
      event,
      addMeet,
    }: {
      calendarId: string;
      event: EventEditorValues;
      addMeet: boolean;
    }) => {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId, event, addMeet }),
      });
      if (!res.ok) throw new Error('Failed to create event');
      return res.json();
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['events'] });
      const snapshot = qc.getQueriesData({ queryKey: ['events'] });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        ctx.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      calendarId,
      event,
      updateScope = 'single',
    }: {
      id: string;
      calendarId: string;
      event: Partial<EventEditorValues>;
      updateScope?: UpdateScope;
    }) => {
      const q = new URLSearchParams({ calendarId, updateScope });
      const res = await fetch(`/api/calendar/events/${id}?${q}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      });
      if (!res.ok) throw new Error('Failed to update event');
      return res.json();
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['events'] });
      const snapshot = qc.getQueriesData({ queryKey: ['events'] });
      // Optimistic: update matching event in all caches
      qc.setQueriesData({ queryKey: ['events'] }, (old: GCalEvent[] | undefined) => {
        if (!old) return old;
        return old.map(e => (e.id === vars.id ? { ...e, ...vars.event } : e));
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        ctx.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      calendarId,
      updateScope = 'single',
    }: {
      id: string;
      calendarId: string;
      updateScope?: UpdateScope;
    }) => {
      const q = new URLSearchParams({ calendarId, updateScope });
      const res = await fetch(`/api/calendar/events/${id}?${q}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete event');
      return res.json();
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['events'] });
      const snapshot = qc.getQueriesData({ queryKey: ['events'] });
      qc.setQueriesData({ queryKey: ['events'] }, (old: GCalEvent[] | undefined) => {
        if (!old) return old;
        return old.filter(e => e.id !== vars.id);
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        ctx.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "hooks\|QueryProvider" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/
git commit -m "feat: React Query provider and calendar hooks"
```

---

## Task 6: MiniMonth Component

**Files:**
- Create: `src/components/calendar/MiniMonth.tsx`

- [ ] **Step 1: Write MiniMonth**

```typescript
// src/components/calendar/MiniMonth.tsx
'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  selectedDate: Date;
  onSelect: (date: Date) => void;
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function isToday(d: Date) {
  return isSameDay(d, new Date());
}

export function MiniMonth({ selectedDate, onSelect }: Props) {
  const [viewMonth, setViewMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const prev = () => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const next = () => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="w-full select-none">
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={prev} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white">
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-semibold text-white/80">{monthLabel}</span>
        <button onClick={next} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white">
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] text-white/40 pb-1">{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const selected = isSameDay(date, selectedDate);
          const today = isToday(date);
          return (
            <button
              key={i}
              onClick={() => onSelect(date)}
              className={[
                'text-[11px] h-6 w-full rounded flex items-center justify-center transition-colors',
                selected ? 'bg-blue-500 text-white font-bold' :
                today ? 'text-blue-400 font-bold hover:bg-white/10' :
                'text-white/70 hover:bg-white/10',
              ].join(' ')}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "MiniMonth" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/MiniMonth.tsx
git commit -m "feat: MiniMonth calendar picker component"
```

---

## Task 7: GuestsInput + RecurrenceBuilder + RecurrencePrompt

**Files:**
- Create: `src/components/calendar/GuestsInput.tsx`
- Create: `src/components/calendar/RecurrenceBuilder.tsx`
- Create: `src/components/calendar/RecurrencePrompt.tsx`

- [ ] **Step 1: Write GuestsInput**

```typescript
// src/components/calendar/GuestsInput.tsx
'use client';
import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface Props {
  value: string[];
  onChange: (guests: string[]) => void;
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function GuestsInput({ value, onChange }: Props) {
  const [input, setInput] = useState('');

  const add = () => {
    const email = input.trim().toLowerCase();
    if (isValidEmail(email) && !value.includes(email)) {
      onChange([...value, email]);
    }
    setInput('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !input && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-2 rounded border border-white/20 bg-white/5 min-h-[40px] focus-within:border-blue-500">
      {value.map(email => (
        <span key={email} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs">
          {email}
          <button type="button" onClick={() => onChange(value.filter(e => e !== email))}>
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        type="email"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={value.length ? '' : 'Add guests...'}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-white/30 outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 2: Write RecurrenceBuilder**

```typescript
// src/components/calendar/RecurrenceBuilder.tsx
'use client';
import { useState } from 'react';

interface Props {
  value: string;
  onChange: (rrule: string) => void;
}

type Preset = 'none' | 'daily' | 'weekly' | 'monthly-date' | 'monthly-nth' | 'yearly' | 'custom';

const DAYS = ['SU','MO','TU','WE','TH','FR','SA'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function RecurrenceBuilder({ value, onChange }: Props) {
  const [preset, setPreset] = useState<Preset>(value ? 'custom' : 'none');
  const [weekDays, setWeekDays] = useState<string[]>(['MO']);
  const [interval, setInterval] = useState(1);

  const build = (p: Preset, days = weekDays, iv = interval) => {
    if (p === 'none') { onChange(''); return; }
    if (p === 'daily') { onChange(`RRULE:FREQ=DAILY;INTERVAL=${iv}`); return; }
    if (p === 'weekly') {
      const by = days.length ? `;BYDAY=${days.join(',')}` : '';
      onChange(`RRULE:FREQ=WEEKLY;INTERVAL=${iv}${by}`);
      return;
    }
    if (p === 'monthly-date') { onChange(`RRULE:FREQ=MONTHLY;INTERVAL=${iv}`); return; }
    if (p === 'monthly-nth') { onChange(`RRULE:FREQ=MONTHLY;INTERVAL=${iv};BYDAY=1MO`); return; }
    if (p === 'yearly') { onChange(`RRULE:FREQ=YEARLY`); return; }
  };

  const setP = (p: Preset) => { setPreset(p); build(p); };
  const toggleDay = (d: string) => {
    const next = weekDays.includes(d) ? weekDays.filter(x => x !== d) : [...weekDays, d];
    setWeekDays(next);
    build(preset, next);
  };

  return (
    <div className="space-y-2">
      <select
        value={preset}
        onChange={e => setP(e.target.value as Preset)}
        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white"
      >
        <option value="none">Does not repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly-date">Monthly on this date</option>
        <option value="monthly-nth">Monthly on nth weekday</option>
        <option value="yearly">Annually</option>
        {value && !['none','daily','weekly','monthly-date','monthly-nth','yearly'].includes(preset) && (
          <option value="custom">Custom (RRULE)</option>
        )}
      </select>

      {(preset === 'daily' || preset === 'weekly') && (
        <div className="flex items-center gap-2 text-sm text-white/70">
          <span>Every</span>
          <input
            type="number"
            min={1}
            value={interval}
            onChange={e => { const iv = Number(e.target.value); setInterval(iv); build(preset, weekDays, iv); }}
            className="w-14 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm"
          />
          <span>{preset === 'daily' ? 'day(s)' : 'week(s)'}</span>
        </div>
      )}

      {preset === 'weekly' && (
        <div className="flex gap-1 flex-wrap">
          {DAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={[
                'w-8 h-8 rounded-full text-xs font-medium transition-colors',
                weekDays.includes(d) ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20',
              ].join(' ')}
            >
              {DAY_LABELS[i].slice(0,1)}
            </button>
          ))}
        </div>
      )}

      {preset === 'custom' && (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="RRULE:FREQ=..."
          className="w-full bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white font-mono"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write RecurrencePrompt**

```typescript
// src/components/calendar/RecurrencePrompt.tsx
'use client';
import type { UpdateScope } from './types';

interface Props {
  action: 'edit' | 'delete';
  onSelect: (scope: UpdateScope) => void;
  onCancel: () => void;
}

export function RecurrencePrompt({ action, onSelect, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] rounded-2xl shadow-2xl p-6 w-80 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-1">
          {action === 'edit' ? 'Edit recurring event' : 'Delete recurring event'}
        </h2>
        <p className="text-sm text-white/50 mb-5">Choose which events to {action}:</p>
        <div className="space-y-2">
          {(['single', 'following', 'all'] as UpdateScope[]).map(scope => (
            <button
              key={scope}
              onClick={() => onSelect(scope)}
              className="w-full text-left px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-sm transition-colors"
            >
              {scope === 'single' && 'This event'}
              {scope === 'following' && 'This and following events'}
              {scope === 'all' && 'All events'}
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="w-full mt-4 text-center text-sm text-white/40 hover:text-white/60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "GuestsInput|RecurrenceBuilder|RecurrencePrompt" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/GuestsInput.tsx src/components/calendar/RecurrenceBuilder.tsx src/components/calendar/RecurrencePrompt.tsx
git commit -m "feat: GuestsInput, RecurrenceBuilder, RecurrencePrompt components"
```

---

## Task 8: UndoToast Component

**Files:**
- Create: `src/components/calendar/UndoToast.tsx`

- [ ] **Step 1: Write UndoToast**

```typescript
// src/components/calendar/UndoToast.tsx
'use client';
import { useEffect, useState } from 'react';
import type { UndoRecord } from './types';

interface Props {
  record: UndoRecord | null;
  onUndo: (record: UndoRecord) => void;
  onDismiss: () => void;
}

export function UndoToast({ record, onUndo, onDismiss }: Props) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!record) return;
    setProgress(100);
    const total = 6000;
    const step = 50;
    const decrement = (step / total) * 100;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p <= 0) { clearInterval(interval); onDismiss(); return 0; }
        return p - decrement;
      });
    }, step);
    return () => clearInterval(interval);
  }, [record]);

  if (!record) return null;

  const label = record.action === 'create' ? 'Event created' :
                record.action === 'delete' ? 'Event deleted' : 'Event updated';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-80 shadow-2xl">
      <div className="bg-[#1e293b] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-white/80">{label}</span>
          <div className="flex items-center gap-3">
            {record.action !== 'create' && (
              <button
                onClick={() => onUndo(record)}
                className="text-sm font-semibold text-blue-400 hover:text-blue-300"
              >
                Undo
              </button>
            )}
            <button onClick={onDismiss} className="text-white/40 hover:text-white/60 text-xs">✕</button>
          </div>
        </div>
        <div
          className="h-0.5 bg-blue-500 transition-all duration-50 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "UndoToast" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/UndoToast.tsx
git commit -m "feat: UndoToast with 6s progress bar"
```

---

## Task 9: EventPopover Component

**Files:**
- Create: `src/components/calendar/EventPopover.tsx`

- [ ] **Step 1: Write EventPopover**

```typescript
// src/components/calendar/EventPopover.tsx
'use client';
import { useRef, useEffect } from 'react';
import { X, Edit2, Trash2, Copy, MapPin, Clock, Video } from 'lucide-react';
import type { GCalEvent } from './types';

interface Props {
  event: GCalEvent;
  position: { x: number; y: number };
  onClose: () => void;
  onEdit: (event: GCalEvent) => void;
  onDelete: (event: GCalEvent) => void;
  onDuplicate: (event: GCalEvent) => void;
}

function formatTime(iso: string, allDay: boolean) {
  if (allDay) return 'All day';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function EventPopover({ event, position, onClose, onEdit, onDelete, onDuplicate }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const startFmt = formatTime(event.start, event.allDay);
  const endFmt = formatTime(event.end, event.allDay);
  const timeLabel = event.allDay ? 'All day' : `${startFmt} – ${endFmt}`;

  return (
    <div
      ref={ref}
      className="fixed z-50 w-72 bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      style={{ top: position.y, left: position.x }}
    >
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: event.calendarColor }}
          />
          <h3 className="font-semibold text-white text-sm truncate">{event.title}</h3>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/70 ml-2 shrink-0">
          <X size={14} />
        </button>
      </div>

      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2 text-white/60 text-xs">
          <Clock size={12} />
          <span>{timeLabel}</span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-white/60 text-xs">
            <MapPin size={12} />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        {event.hangoutLink && (
          <div className="flex items-center gap-2 text-xs">
            <Video size={12} className="text-blue-400" />
            <a href={event.hangoutLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">
              Join Google Meet
            </a>
          </div>
        )}
        {event.description && (
          <p className="text-white/50 text-xs line-clamp-3">{event.description}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-1 px-3 pb-3 border-t border-white/10 pt-2">
        <button
          onClick={() => { onDuplicate(event); onClose(); }}
          className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          title="Duplicate"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={() => { onEdit(event); onClose(); }}
          className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          title="Edit"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => { onDelete(event); onClose(); }}
          className="p-1.5 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "EventPopover" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/EventPopover.tsx
git commit -m "feat: EventPopover click-chip popover"
```

---

## Task 10: EventEditorModal Component

**Files:**
- Create: `src/components/calendar/EventEditorModal.tsx`

- [ ] **Step 1: Write EventEditorModal**

```typescript
// src/components/calendar/EventEditorModal.tsx
'use client';
import { useState, useEffect } from 'react';
import { X, MapPin, AlignLeft, Users, Video, Repeat, Calendar } from 'lucide-react';
import type { GCalEvent, GCalCalendar, EventEditorValues } from './types';
import { GuestsInput } from './GuestsInput';
import { RecurrenceBuilder } from './RecurrenceBuilder';

interface Props {
  event?: GCalEvent | null;
  defaultStart?: string;
  defaultEnd?: string;
  calendars: GCalCalendar[];
  defaultCalendarId: string;
  onSave: (values: EventEditorValues, calendarId: string) => void;
  onClose: () => void;
}

const GOOGLE_COLORS = [
  { id: '1', label: 'Tomato', hex: '#d50000' },
  { id: '2', label: 'Flamingo', hex: '#e67c73' },
  { id: '3', label: 'Tangerine', hex: '#f4511e' },
  { id: '4', label: 'Banana', hex: '#f6bf26' },
  { id: '5', label: 'Sage', hex: '#33b679' },
  { id: '6', label: 'Basil', hex: '#0b8043' },
  { id: '7', label: 'Peacock', hex: '#039be5' },
  { id: '8', label: 'Blueberry', hex: '#3f51b5' },
  { id: '9', label: 'Lavender', hex: '#7986cb' },
  { id: '10', label: 'Grape', hex: '#8e24aa' },
  { id: '11', label: 'Graphite', hex: '#616161' },
];

function toLocalDatetimeInput(iso: string): string {
  // Convert ISO to "YYYY-MM-DDTHH:mm" for datetime-local input
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventEditorModal({ event, defaultStart, defaultEnd, calendars, defaultCalendarId, onSave, onClose }: Props) {
  const now = new Date();
  const oneHour = new Date(now.getTime() + 60*60*1000);

  const initStart = event ? toLocalDatetimeInput(event.start) :
    defaultStart ? toLocalDatetimeInput(defaultStart) :
    toLocalDatetimeInput(now.toISOString());
  const initEnd = event ? toLocalDatetimeInput(event.end) :
    defaultEnd ? toLocalDatetimeInput(defaultEnd) :
    toLocalDatetimeInput(oneHour.toISOString());

  const [title, setTitle] = useState(event?.title ?? '');
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [start, setStart] = useState(initStart);
  const [end, setEnd] = useState(initEnd);
  const [description, setDescription] = useState(event?.description ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [color, setColor] = useState(event?.color ?? '');
  const [calId, setCalId] = useState(event?.calendarId ?? defaultCalendarId);
  const [recurrence, setRecurrence] = useState(event?.recurrence ?? '');
  const [guests, setGuests] = useState<string[]>(event?.attendees?.map(a => a.email ?? '') ?? []);
  const [addMeet, setAddMeet] = useState(!!event?.hangoutLink);

  const writableCalendars = calendars.filter(c => c.accessRole === 'owner' || c.accessRole === 'writer');

  const submit = () => {
    if (!title.trim()) return;
    onSave({ title, allDay, start: new Date(start).toISOString(), end: new Date(end).toISOString(), description, location, color, calendarId: calId, recurrence, guests, addMeet }, calId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1e293b] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/10">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{event ? 'Edit event' : 'New event'}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Title */}
          <input
            autoFocus
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Add title"
            className="w-full bg-transparent border-b border-white/20 focus:border-blue-500 pb-2 text-xl font-semibold text-white placeholder-white/30 outline-none"
          />

          {/* All-day toggle + time */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="accent-blue-500" />
              All day
            </label>
            {!allDay && (
              <div className="flex items-center gap-2">
                <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white" />
                <span className="text-white/40 text-sm">→</span>
                <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white" />
              </div>
            )}
            {allDay && (
              <div className="flex items-center gap-2">
                <input type="date" value={start.split('T')[0]} onChange={e => setStart(e.target.value + 'T00:00')}
                  className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white" />
                <span className="text-white/40 text-sm">→</span>
                <input type="date" value={end.split('T')[0]} onChange={e => setEnd(e.target.value + 'T00:00')}
                  className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white" />
              </div>
            )}
          </div>

          {/* Location */}
          <div className="flex items-start gap-2">
            <MapPin size={16} className="text-white/40 mt-2 shrink-0" />
            <input type="text" value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Add location"
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30" />
          </div>

          {/* Description */}
          <div className="flex items-start gap-2">
            <AlignLeft size={16} className="text-white/40 mt-2 shrink-0" />
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Add description"
              rows={2}
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 resize-none" />
          </div>

          {/* Color */}
          <div className="flex flex-wrap gap-1.5">
            {GOOGLE_COLORS.map(c => (
              <button key={c.id} type="button" onClick={() => setColor(c.id)}
                title={c.label}
                className={['w-6 h-6 rounded-full transition-transform', color === c.id ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1e293b] scale-110' : 'hover:scale-110'].join(' ')}
                style={{ backgroundColor: c.hex }}
              />
            ))}
            <button type="button" onClick={() => setColor('')}
              className={['w-6 h-6 rounded-full bg-white/20 text-white/60 text-xs flex items-center justify-center transition-transform', !color ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1e293b]' : 'hover:scale-110'].join(' ')}>
              ✕
            </button>
          </div>

          {/* Calendar picker */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-white/40 shrink-0" />
            <select value={calId} onChange={e => setCalId(e.target.value)}
              className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white">
              {writableCalendars.map(c => (
                <option key={c.id} value={c.id ?? ''}>{c.summary}</option>
              ))}
            </select>
          </div>

          {/* Recurrence */}
          <div className="flex items-start gap-2">
            <Repeat size={16} className="text-white/40 mt-2 shrink-0" />
            <div className="flex-1">
              <RecurrenceBuilder value={recurrence} onChange={setRecurrence} />
            </div>
          </div>

          {/* Guests */}
          <div className="flex items-start gap-2">
            <Users size={16} className="text-white/40 mt-2.5 shrink-0" />
            <div className="flex-1">
              <GuestsInput value={guests} onChange={setGuests} />
            </div>
          </div>

          {/* Google Meet */}
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
            <Video size={16} className="text-white/40" />
            <input type="checkbox" checked={addMeet} onChange={e => setAddMeet(e.target.checked)} className="accent-blue-500" />
            Add Google Meet video conferencing
          </label>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={!title.trim()}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">
            {event ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "EventEditorModal" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/EventEditorModal.tsx
git commit -m "feat: EventEditorModal with full Google-parity fields"
```

---

## Task 11: YearView Component

**Files:**
- Create: `src/components/calendar/YearView.tsx`

- [ ] **Step 1: Write YearView**

```typescript
// src/components/calendar/YearView.tsx
'use client';
import type { GCalEvent } from './types';

interface Props {
  year: number;
  events: GCalEvent[];
  onMonthClick: (date: Date) => void;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function hasEvent(events: GCalEvent[], date: Date): boolean {
  const ds = date.toISOString().split('T')[0];
  return events.some(e => e.start.startsWith(ds));
}

function renderMiniMonth(year: number, month: number, events: GCalEvent[], onMonthClick: (d: Date) => void) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const today = new Date();

  return (
    <div key={month} className="cursor-pointer group" onClick={() => onMonthClick(new Date(year, month, 1))}>
      <div className="text-xs font-semibold text-white/70 mb-1.5 group-hover:text-white transition-colors">
        {MONTHS[month]}
      </div>
      <div className="grid grid-cols-7 gap-0">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] text-white/30">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const date = new Date(year, month, day);
          const isToday = today.toDateString() === date.toDateString();
          const evt = hasEvent(events, date);
          return (
            <div key={i} className="flex items-center justify-center relative">
              <div className={[
                'text-[10px] w-5 h-5 rounded-full flex items-center justify-center',
                isToday ? 'bg-blue-500 text-white font-bold' :
                evt ? 'text-white' : 'text-white/50',
              ].join(' ')}>
                {day}
              </div>
              {evt && !isToday && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function YearView({ year, events, onMonthClick }: Props) {
  return (
    <div className="grid grid-cols-4 gap-6 p-4">
      {Array.from({ length: 12 }, (_, i) => renderMiniMonth(year, i, events, onMonthClick))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "YearView" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/YearView.tsx
git commit -m "feat: YearView 12-month grid"
```

---

## Task 12: CalendarGrid — schedule-x Integration

**Files:**
- Create: `src/components/calendar/CalendarGrid.tsx`

Note: Check the schedule-x v2 API. The pattern is:
- `useCalendarApp({ views: [...], events: [...], plugins: [...] })`
- `<ScheduleXCalendar calendarApp={calApp} />`
- Import CSS: `import '@schedule-x/theme-default/dist/index.css'`
- Drag-and-drop plugin: `createDragAndDropPlugin()`
- Resize plugin: `createEventRecurrencePlugin()` or `createResizePlugin()`
- Events have shape: `{ id, title, start, end, calendarId }`

- [ ] **Step 1: Write CalendarGrid**

```typescript
// src/components/calendar/CalendarGrid.tsx
'use client';
import { useEffect, useRef, useMemo } from 'react';
import {
  useCalendarApp,
  ScheduleXCalendar,
} from '@schedule-x/react';
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
  createViewMonthAgenda,
} from '@schedule-x/calendar';
import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop';
import { createEventRecurrencePlugin } from '@schedule-x/event-recurrence';
import '@schedule-x/theme-default/dist/index.css';
import type { GCalEvent, GCalCalendar, ViewMode } from './types';

interface Props {
  events: GCalEvent[];
  calendars: GCalCalendar[];
  view: ViewMode;
  date: Date;
  onEventClick: (event: GCalEvent, domEvent: MouseEvent) => void;
  onSlotClick: (start: string, end: string) => void;
  onEventDrop: (eventId: string, newStart: string, newEnd: string, calendarId: string) => void;
  onEventResize: (eventId: string, newStart: string, newEnd: string, calendarId: string) => void;
}

export function CalendarGrid({ events, calendars, view, date, onEventClick, onSlotClick, onEventDrop, onEventResize }: Props) {
  const calendarColors = useMemo(() => {
    const map: Record<string, string> = {};
    calendars.forEach(c => { if (c.id) map[c.id] = c.backgroundColor; });
    return map;
  }, [calendars]);

  const sxEvents = useMemo(() =>
    events.map(e => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      calendarId: e.calendarId,
      description: e.description,
      location: e.location,
      _gcal: e,
    })),
    [events]
  );

  const calApp = useCalendarApp({
    views: [createViewDay(), createViewWeek(), createViewMonthGrid(), createViewMonthAgenda()],
    defaultView: view === 'day' ? 'day' : view === 'week' ? 'week' : view === 'schedule' ? 'month-agenda' : 'month-grid',
    selectedDate: date.toISOString().split('T')[0],
    events: sxEvents,
    calendars: Object.fromEntries(
      calendars.map(c => [c.id, { colorName: c.id, lightColors: { main: c.backgroundColor, container: c.backgroundColor + '33', onContainer: '#ffffff' }, darkColors: { main: c.backgroundColor, container: c.backgroundColor + '33', onContainer: '#ffffff' } }])
    ),
    plugins: [
      createDragAndDropPlugin(),
    ],
    callbacks: {
      onEventClick(event: any, domEvent: MouseEvent) {
        const gcal = events.find(e => e.id === event.id);
        if (gcal) onEventClick(gcal, domEvent);
      },
      onClickDate(date: string) {
        const start = date + 'T09:00:00';
        const end = date + 'T10:00:00';
        onSlotClick(start, end);
      },
      onEventUpdate(event: any) {
        onEventDrop(event.id, event.start, event.end, event.calendarId);
      },
    },
  });

  // Sync events reactively
  useEffect(() => {
    if (!calApp) return;
    calApp.eventsService.set(sxEvents);
  }, [sxEvents, calApp]);

  // Sync selected date
  useEffect(() => {
    if (!calApp) return;
    calApp.setDate(date.toISOString().split('T')[0]);
  }, [date, calApp]);

  return (
    <div className="sx-calendar-wrapper h-full [&_.sx__calendar-wrapper]:h-full [&_.sx__calendar]:h-full">
      <ScheduleXCalendar calendarApp={calApp} />
    </div>
  );
}
```

Note: The exact schedule-x API may differ slightly from v2. If `useCalendarApp` or import paths differ, check the installed package: `cat node_modules/@schedule-x/react/dist/index.js | head -50` and adjust accordingly. The key is `ScheduleXCalendar` + `useCalendarApp` from `@schedule-x/react`, views from `@schedule-x/calendar`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "CalendarGrid" | head -10
```

Fix any type errors by checking the actual schedule-x types: `cat node_modules/@schedule-x/calendar/dist/index.d.ts | head -100`

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/CalendarGrid.tsx
git commit -m "feat: CalendarGrid with schedule-x integration"
```

---

## Task 13: Sidebar Component

**Files:**
- Create: `src/components/calendar/Sidebar.tsx`

- [ ] **Step 1: Write Sidebar**

```typescript
// src/components/calendar/Sidebar.tsx
'use client';
import { Plus } from 'lucide-react';
import { MiniMonth } from './MiniMonth';
import type { GCalCalendar } from './types';

interface Props {
  date: Date;
  onDateChange: (d: Date) => void;
  calendars: GCalCalendar[];
  visibleCalendars: Set<string>;
  onToggleCalendar: (id: string) => void;
  onCreateEvent: () => void;
}

export function Sidebar({ date, onDateChange, calendars, visibleCalendars, onToggleCalendar, onCreateEvent }: Props) {
  const myCalendars = calendars.filter(c => c.accessRole === 'owner' || c.accessRole === 'writer');
  const otherCalendars = calendars.filter(c => c.accessRole === 'reader' || c.accessRole === 'freeBusyReader');

  return (
    <aside className="w-56 shrink-0 flex flex-col gap-4 py-4">
      <button
        onClick={onCreateEvent}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm shadow-lg border border-white/10 transition-colors w-fit"
      >
        <Plus size={16} />
        Create
      </button>

      <MiniMonth selectedDate={date} onSelect={onDateChange} />

      {myCalendars.length > 0 && (
        <div>
          <div className="text-[11px] text-white/40 uppercase tracking-widest mb-2 px-1">My calendars</div>
          <ul className="space-y-0.5">
            {myCalendars.map(cal => (
              <CalendarToggleRow key={cal.id} cal={cal} checked={visibleCalendars.has(cal.id ?? '')} onToggle={() => onToggleCalendar(cal.id ?? '')} />
            ))}
          </ul>
        </div>
      )}

      {otherCalendars.length > 0 && (
        <div>
          <div className="text-[11px] text-white/40 uppercase tracking-widest mb-2 px-1">Other calendars</div>
          <ul className="space-y-0.5">
            {otherCalendars.map(cal => (
              <CalendarToggleRow key={cal.id} cal={cal} checked={visibleCalendars.has(cal.id ?? '')} onToggle={() => onToggleCalendar(cal.id ?? '')} />
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

function CalendarToggleRow({ cal, checked, onToggle }: { cal: GCalCalendar; checked: boolean; onToggle: () => void }) {
  return (
    <li>
      <label className="flex items-center gap-2 px-1 py-1 rounded hover:bg-white/5 cursor-pointer">
        <span
          className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
          style={{ borderColor: cal.backgroundColor, backgroundColor: checked ? cal.backgroundColor : 'transparent' }}
          onClick={onToggle}
        >
          {checked && <span className="text-white text-[8px] leading-none">✓</span>}
        </span>
        <span className="text-sm text-white/70 truncate">{cal.summary}</span>
      </label>
    </li>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "Sidebar" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/Sidebar.tsx
git commit -m "feat: Sidebar with mini-month, calendar list, Create button"
```

---

## Task 14: CalendarShell — Main Orchestration Component

**Files:**
- Create: `src/components/calendar/CalendarShell.tsx`

- [ ] **Step 1: Write CalendarShell**

```typescript
// src/components/calendar/CalendarShell.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { CalendarGrid } from './CalendarGrid';
import { YearView } from './YearView';
import { EventPopover } from './EventPopover';
import { EventEditorModal } from './EventEditorModal';
import { RecurrencePrompt } from './RecurrencePrompt';
import { UndoToast } from './UndoToast';
import { useCalendars } from './hooks/useCalendars';
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from './hooks/useEvents';
import type { GCalEvent, GCalCalendar, ViewMode, UndoRecord, EventEditorValues, UpdateScope } from './types';

const VIEW_LABELS: Record<ViewMode, string> = {
  day: 'Day', week: 'Week', month: 'Month', year: 'Year', schedule: 'Schedule',
};

const LS_KEY = 'calendar.visibleCalendars';

function loadVisible(calendars: GCalCalendar[]): Set<string> {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set(calendars.map(c => c.id).filter(Boolean) as string[]);
}

function getViewRange(date: Date, view: ViewMode): { timeMin: string; timeMax: string } {
  const d = new Date(date);
  if (view === 'day') {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }
  if (view === 'week') {
    const day = d.getDay();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    const end = new Date(start.getTime() + 7 * 86400000);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }
  if (view === 'year') {
    return {
      timeMin: new Date(d.getFullYear(), 0, 1).toISOString(),
      timeMax: new Date(d.getFullYear() + 1, 0, 1).toISOString(),
    };
  }
  // month + schedule: 3-month window centered on current month
  return {
    timeMin: new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString(),
    timeMax: new Date(d.getFullYear(), d.getMonth() + 2, 1).toISOString(),
  };
}

function formatViewTitle(date: Date, view: ViewMode): string {
  const opts: Intl.DateTimeFormatOptions = view === 'year'
    ? { year: 'numeric' }
    : view === 'day'
    ? { month: 'long', day: 'numeric', year: 'numeric' }
    : { month: 'long', year: 'numeric' };
  return date.toLocaleDateString('en-US', opts);
}

function navigate(date: Date, view: ViewMode, dir: 1 | -1): Date {
  const d = new Date(date);
  if (view === 'day') d.setDate(d.getDate() + dir);
  else if (view === 'week') d.setDate(d.getDate() + dir * 7);
  else if (view === 'year') d.setFullYear(d.getFullYear() + dir);
  else d.setMonth(d.getMonth() + dir);
  return d;
}

export function CalendarShell() {
  const [view, setView] = useState<ViewMode>('month');
  const [date, setDate] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set());

  const [popover, setPopover] = useState<{ event: GCalEvent; x: number; y: number } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<GCalEvent | null>(null);
  const [defaultSlot, setDefaultSlot] = useState<{ start: string; end: string } | null>(null);
  const [recurrencePrompt, setRecurrencePrompt] = useState<{
    action: 'edit' | 'delete';
    event: GCalEvent;
    values?: Partial<EventEditorValues>;
  } | null>(null);
  const [undoRecord, setUndoRecord] = useState<UndoRecord | null>(null);

  const { data: calendars = [] } = useCalendars();
  const { timeMin, timeMax } = getViewRange(date, view);
  const visibleIds = Array.from(visibleCalendars);
  const { data: allEvents = [] } = useEvents({ calendarIds: visibleIds, timeMin, timeMax });

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  // Init visible calendars from localStorage on first load
  useEffect(() => {
    if (calendars.length && visibleCalendars.size === 0) {
      setVisibleCalendars(loadVisible(calendars));
    }
  }, [calendars]);

  // Persist visible calendars
  useEffect(() => {
    if (visibleCalendars.size) {
      localStorage.setItem(LS_KEY, JSON.stringify(Array.from(visibleCalendars)));
    }
  }, [visibleCalendars]);

  // Keyboard shortcut: 'c' = create
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setEditorOpen(true);
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);

  const toggleCalendar = (id: string) => {
    setVisibleCalendars(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleEventClick = useCallback((event: GCalEvent, domEvent: MouseEvent) => {
    const rect = (domEvent.target as HTMLElement).getBoundingClientRect();
    setPopover({ event, x: rect.right + 8, y: rect.top });
  }, []);

  const handleSlotClick = useCallback((start: string, end: string) => {
    setDefaultSlot({ start, end });
    setEditingEvent(null);
    setEditorOpen(true);
  }, []);

  const handleCreate = async (values: EventEditorValues, calId: string) => {
    setEditorOpen(false);
    await createEvent.mutateAsync({ calendarId: calId, event: values, addMeet: values.addMeet });
    setUndoRecord({ action: 'create', eventId: '', calendarId: calId });
  };

  const handleUpdate = async (values: EventEditorValues, calId: string, updateScope: UpdateScope = 'single') => {
    if (!editingEvent) return;
    const prev = { ...editingEvent };
    setEditorOpen(false);
    await updateEvent.mutateAsync({ id: editingEvent.id, calendarId: calId, event: values, updateScope });
    setUndoRecord({ action: 'update', eventId: editingEvent.id, calendarId: calId, previousState: prev });
  };

  const handleDeleteConfirmed = async (event: GCalEvent, updateScope: UpdateScope = 'single') => {
    const prev = { ...event };
    await deleteEvent.mutateAsync({ id: event.id, calendarId: event.calendarId, updateScope });
    setUndoRecord({ action: 'delete', eventId: event.id, calendarId: event.calendarId, previousState: prev });
  };

  const handleEditEvent = (event: GCalEvent) => {
    if (event.recurringEventId) {
      setRecurrencePrompt({ action: 'edit', event });
    } else {
      setEditingEvent(event);
      setEditorOpen(true);
    }
  };

  const handleDeleteEvent = (event: GCalEvent) => {
    if (event.recurringEventId) {
      setRecurrencePrompt({ action: 'delete', event });
    } else {
      handleDeleteConfirmed(event, 'single');
    }
  };

  const handleRecurrenceSelect = (scope: UpdateScope) => {
    if (!recurrencePrompt) return;
    if (recurrencePrompt.action === 'delete') {
      handleDeleteConfirmed(recurrencePrompt.event, scope);
    } else {
      setEditingEvent(recurrencePrompt.event);
      setEditorOpen(true);
    }
    setRecurrencePrompt(null);
  };

  const handleUndo = async (record: UndoRecord) => {
    setUndoRecord(null);
    if (record.action === 'delete' && record.previousState) {
      const prev = record.previousState as GCalEvent;
      await createEvent.mutateAsync({
        calendarId: record.calendarId,
        event: {
          title: prev.title,
          allDay: prev.allDay,
          start: prev.start,
          end: prev.end,
          description: prev.description ?? '',
          location: prev.location ?? '',
          color: prev.color ?? '',
          calendarId: record.calendarId,
          recurrence: prev.recurrence ?? '',
          guests: prev.attendees?.map(a => a.email ?? '') ?? [],
          addMeet: false,
        },
        addMeet: false,
      });
    }
    if (record.action === 'update' && record.previousState) {
      const prev = record.previousState as GCalEvent;
      await updateEvent.mutateAsync({
        id: record.eventId,
        calendarId: record.calendarId,
        event: {
          title: prev.title,
          allDay: prev.allDay,
          start: prev.start,
          end: prev.end,
          description: prev.description,
          location: prev.location,
        },
        updateScope: 'single',
      });
    }
  };

  const handleEventDrop = async (eventId: string, newStart: string, newEnd: string, calId: string) => {
    await updateEvent.mutateAsync({ id: eventId, calendarId: calId, event: { start: newStart, end: newEnd } });
  };

  const handleDuplicate = async (event: GCalEvent) => {
    const calId = calendars.find(c => c.primary)?.id ?? event.calendarId;
    await createEvent.mutateAsync({
      calendarId: calId,
      event: {
        title: `${event.title} (copy)`,
        allDay: event.allDay,
        start: event.start,
        end: event.end,
        description: event.description ?? '',
        location: event.location ?? '',
        color: event.color ?? '',
        calendarId: calId,
        recurrence: '',
        guests: [],
        addMeet: false,
      },
      addMeet: false,
    });
  };

  const primaryCalId = calendars.find(c => c.primary)?.id ?? calendars[0]?.id ?? 'primary';

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <button onClick={() => setSidebarOpen(o => !o)} className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors lg:hidden">
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <button
          onClick={() => setDate(new Date())}
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
        >
          Today
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => setDate(d => navigate(d, view, -1))} className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setDate(d => navigate(d, view, 1))} className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
        <span className="text-base font-semibold text-white/90 flex-1">
          {formatViewTitle(date, view)}
        </span>
        {/* View switcher */}
        <div className="hidden sm:flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {(['day', 'week', 'month', 'year', 'schedule'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={[
                'px-3 py-1 rounded text-sm font-medium transition-colors',
                view === v ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80',
              ].join(' ')}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        {/* Mobile view switcher dropdown */}
        <select
          className="sm:hidden bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
          value={view}
          onChange={e => setView(e.target.value as ViewMode)}
        >
          {(['day','week','month','year','schedule'] as ViewMode[]).map(v => (
            <option key={v} value={v}>{VIEW_LABELS[v]}</option>
          ))}
        </select>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={[
          'transition-all duration-200 overflow-hidden border-r border-white/10',
          sidebarOpen ? 'w-56 opacity-100' : 'w-0 opacity-0',
        ].join(' ')}>
          <div className="w-56 h-full overflow-y-auto px-3">
            <Sidebar
              date={date}
              onDateChange={d => { setDate(d); if (view === 'year') setView('month'); }}
              calendars={calendars}
              visibleCalendars={visibleCalendars}
              onToggleCalendar={toggleCalendar}
              onCreateEvent={() => { setEditingEvent(null); setDefaultSlot(null); setEditorOpen(true); }}
            />
          </div>
        </div>

        {/* Main grid */}
        <div className="flex-1 overflow-hidden">
          {view === 'year' ? (
            <YearView
              year={date.getFullYear()}
              events={allEvents}
              onMonthClick={d => { setDate(d); setView('month'); }}
            />
          ) : (
            <CalendarGrid
              events={allEvents}
              calendars={calendars}
              view={view}
              date={date}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              onEventDrop={handleEventDrop}
              onEventResize={(id, s, e, calId) => updateEvent.mutateAsync({ id, calendarId: calId, event: { start: s, end: e } })}
            />
          )}
        </div>
      </div>

      {/* Popover */}
      {popover && (
        <EventPopover
          event={popover.event}
          position={{ x: popover.x, y: popover.y }}
          onClose={() => setPopover(null)}
          onEdit={handleEditEvent}
          onDelete={handleDeleteEvent}
          onDuplicate={handleDuplicate}
        />
      )}

      {/* Editor modal */}
      {editorOpen && (
        <EventEditorModal
          event={editingEvent}
          defaultStart={defaultSlot?.start}
          defaultEnd={defaultSlot?.end}
          calendars={calendars}
          defaultCalendarId={editingEvent?.calendarId ?? primaryCalId}
          onSave={(values, calId) => {
            if (editingEvent) handleUpdate(values, calId);
            else handleCreate(values, calId);
          }}
          onClose={() => { setEditorOpen(false); setEditingEvent(null); setDefaultSlot(null); }}
        />
      )}

      {/* Recurrence prompt */}
      {recurrencePrompt && (
        <RecurrencePrompt
          action={recurrencePrompt.action}
          onSelect={handleRecurrenceSelect}
          onCancel={() => setRecurrencePrompt(null)}
        />
      )}

      {/* Undo toast */}
      <UndoToast
        record={undoRecord}
        onUndo={handleUndo}
        onDismiss={() => setUndoRecord(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "CalendarShell" | head -20
```

Fix any errors. Common issues: `useCalendarApp` return type, `calendars` null checks on `c.id`.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/CalendarShell.tsx
git commit -m "feat: CalendarShell main orchestration component"
```

---

## Task 15: Update /calendar Route Page

**Files:**
- Modify: `src/app/calendar/page.tsx`

- [ ] **Step 1: Replace page content**

Replace the entire file with:

```typescript
// src/app/calendar/page.tsx
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import Header from '@/components/Header';
import { CalendarQueryProvider } from '@/components/calendar/QueryProvider';
import { CalendarShell } from '@/components/calendar/CalendarShell';

export default async function CalendarPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col overflow-hidden px-2 py-2">
        <div className="liquid-glass rounded-2xl flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <CalendarQueryProvider>
            <CalendarShell />
          </CalendarQueryProvider>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "calendar/page" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/calendar/page.tsx
git commit -m "feat: replace calendar page with new shell + React Query provider"
```

---

## Task 16: Update Scan Page + Cleanup Old Files

**Files:**
- Modify: `src/app/scan/page.tsx`
- Delete: `src/components/LiveCalendarView.tsx`
- Delete: `src/components/EmbeddedCalendarView.tsx`
- Delete: `src/app/api/calendar/embed-url/route.ts`

- [ ] **Step 1: Update scan/page.tsx — remove old calendar tabs, add link to /calendar**

In `src/app/scan/page.tsx`:
1. Remove `import LiveCalendarView from '@/components/LiveCalendarView';`
2. Remove `import EmbeddedCalendarView from '@/components/EmbeddedCalendarView';`
3. Remove `import GoogleAuthWrapper from '@/components/GoogleAuthWrapper';` (if only used for calendar)
4. Change the `activeTab` type: remove `'live-calendar' | 'embedded-calendar'`
5. Remove the tab buttons for `live-calendar` and `embedded-calendar`
6. Remove the conditional renders for those tabs
7. Add a banner/link: where the calendar tabs were, add a link to `/calendar`

Minimal replacement for the calendar tab section (find the tab buttons and replace):

```tsx
{/* Replace live-calendar and embedded-calendar tab buttons with: */}
<Link href="/calendar" className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-blue-500/20 text-blue-300 text-sm font-medium hover:bg-blue-500/30 transition-colors">
  <Calendar size={14} />
  Open Calendar
</Link>
```

Add `import Link from 'next/link';` at the top.

Read the full scan/page.tsx first to understand the tab structure, then make the targeted edits.

- [ ] **Step 2: Delete old files**

```bash
rm /Users/martinofunrein/Downloads/syllascan/src/components/LiveCalendarView.tsx
rm /Users/martinofunrein/Downloads/syllascan/src/components/EmbeddedCalendarView.tsx
rm /Users/martinofunrein/Downloads/syllascan/src/app/api/calendar/embed-url/route.ts
```

- [ ] **Step 3: Type-check after cleanup**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any remaining import errors (e.g., if `CalendarAuthBanner` imports from deleted files, update it).

- [ ] **Step 4: Verify dev server starts**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds or only pre-existing errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove LiveCalendarView/EmbeddedCalendarView, link scan page to /calendar"
```

---

## Task 17: schedule-x CSS Integration + Theming

**Files:**
- Modify: `src/app/globals.css` or `src/components/calendar/CalendarGrid.tsx`

schedule-x ships its own CSS. We need to override variables to match the dark `liquid-glass` theme.

- [ ] **Step 1: Add schedule-x dark theme overrides in CalendarGrid.tsx**

In the `CalendarGrid` component, add a `<style>` tag or use a CSS module. Since the project uses Tailwind + globals.css, add overrides to `globals.css`:

```css
/* schedule-x dark theme overrides — must come after the schedule-x import */
.sx__calendar-wrapper {
  --sx-color-background-primary: transparent !important;
  --sx-color-background-secondary: rgba(255,255,255,0.03) !important;
  --sx-color-on-surface: rgba(255,255,255,0.85) !important;
  --sx-color-on-surface-variant: rgba(255,255,255,0.5) !important;
  --sx-color-primary: #3b82f6 !important;
  --sx-color-surface: transparent !important;
  --sx-border-color: rgba(255,255,255,0.1) !important;
}
```

- [ ] **Step 2: Verify calendar renders at dev server**

```bash
npm run dev &
# Wait 5 seconds, then check for errors
sleep 5 && curl -s http://localhost:3000/calendar | grep -i "error" | head -5
```

If server runs clean, the component renders.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: schedule-x dark theme CSS overrides"
```

---

## Task 18: Final TypeScript Check + Build Verification

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Fix all errors. Common issues to watch for:
- `c.id` possibly undefined in `GCalCalendar` — use `c.id ?? ''`
- `useCalendarApp` return type — wrap with `as any` if needed for now
- Missing `'use client'` directives on components that use hooks
- `params` in Next.js route handlers must be `Promise<{ id: string }>` in Next 15

- [ ] **Step 2: Production build**

```bash
npm run build 2>&1 | tail -30
```

Expected: build succeeds. Fix any remaining errors.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: resolve TypeScript errors in calendar redesign"
```

---

## Self-Review Against Spec

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Route `/calendar` | Task 15 |
| Day/Week/Month/Year/Schedule views | Task 12 (CalendarGrid), Task 11 (YearView) |
| Create button + click slot + drag range | Tasks 13 (Sidebar), 14 (CalendarShell `onSlotClick`) |
| Event click popover | Task 9 |
| Full editor (all fields) | Task 10 |
| Drag/resize | Task 12 (`createDragAndDropPlugin`) |
| Multi-calendar toggle | Tasks 13 (Sidebar), 4 (multi-calendar GET) |
| Optimistic mutations + undo toast | Tasks 5, 8, 14 |
| Recurrence RRULE builder | Task 7 |
| RecurrencePrompt | Task 7 |
| `calendarList.list` API | Task 4 |
| POST/PATCH/DELETE API routes | Task 4 |
| Token refresh + reconnect banner | Task 3 |
| localhost persist visible calendars | Task 14 (`LS_KEY`) |
| Google Meet toggle | Task 10 (`addMeet`) |
| Delete old views + scan redirect | Task 16 |
| schedule-x library | Tasks 1, 12 |
| React Query | Tasks 1, 5 |

**Gaps / notes:**
- Rate limit exponential backoff (spec §Error handling 429): add to `handleGoogleApiError` or individual route catch blocks — retry 3x with 1s/2s/4s delay if needed.
- Reconnect banner: `CalendarShell` should check for `reconnectRequired` in query errors and render `CalendarAuthBanner`. Add an `onError` check in the `useCalendars`/`useEvents` query options.
- The `createEventRecurrencePlugin` or `createResizePlugin` may be needed from schedule-x for resize support — check the installed packages: `ls node_modules/@schedule-x/` and add if present.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-15-google-calendar-ui-redesign.md`.
