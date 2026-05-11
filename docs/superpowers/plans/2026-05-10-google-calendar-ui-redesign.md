# Google Calendar-Style Live View — Implementation Plan

**Date:** 2026-05-10
**Branch:** `google-calendar-ui-redesign`
**Spec:** `docs/superpowers/specs/2026-05-10-google-calendar-ui-redesign-design.md`
**Effort:** medium
**Status:** Ready for implementation

## Overview

Replace `LiveCalendarView` + `EmbeddedCalendarView` with single interactive `/calendar` route backed by `schedule-x`, full Google Calendar API read/write, optimistic mutations with undo toast, multi-calendar, recurrence, Meet integration. Responsive-first: mobile collapses sidebar to hamburger drawer, toolbar view switcher becomes dropdown, modals go full-screen on small viewports.

## Responsive breakpoints (Tailwind)

| Prefix | Min-width | Behavior |
|--------|-----------|----------|
| default | 0px | Mobile: sidebar hidden behind drawer, toolbar compact, view switcher = dropdown, editor = full-screen sheet, popover = bottom sheet, Day view default |
| `md` | 768px | Tablet: sidebar can toggle, toolbar full, view switcher = segmented buttons, editor = centered modal, Week view default |
| `lg` | 1024px | Desktop: sidebar persistent open, mini-month + calendar list visible, Week view default |
| `xl` | 1280px | Wide: sidebar + main + optional right-rail reserved for future (no content in v1) |

Touch targets ≥44px on mobile. All drag/resize gestures must have equivalent click/modal path (drag requires pointer precision; mobile falls back to tap → editor).

## React Query cache schema

All keys arrays, first element = resource name, subsequent = params in stable order.

| Key | Shape | Stale | GC | Invalidated by |
|-----|-------|-------|-----|----------------|
| `['calendars']` | `CalendarListEntry[]` | 5 min | 30 min | `useReconnect()` success |
| `['events', calendarIds.sort().join(','), timeMin.toISOString(), timeMax.toISOString()]` | `CalendarEvent[]` tagged with `calendarId`+`calendarColor` | 30 s | 10 min | all mutations |
| `['event', calendarId, eventId]` | single `CalendarEvent` (used by popover/editor for fresh fetch) | 10 s | 5 min | `useUpdateEvent`, `useDeleteEvent` for that id |
| `['freeBusy', calendarIds, timeMin, timeMax]` | v2 only, reserved | — | — | — |

Mutation keys:
- `['mutate', 'event.create']`
- `['mutate', 'event.update', eventId]`
- `['mutate', 'event.delete', eventId]`

Optimistic shape: `onMutate` returns `{ previousEvents: QueryData, previousEvent?: QueryData, undoSnapshot: CalendarEvent }`. `onError` restores with `queryClient.setQueryData`. `onSettled` invalidates `['events']` + `['event', calendarId, eventId]`.

## Accessibility requirements

WCAG 2.1 AA target.

**Focus management**
- Modal/sheet open → trap focus, return to trigger on close (use Radix Dialog primitives).
- First focusable inside editor = title input, autofocus on create; first action button on edit.
- Popover open → focus first action (`Edit`).
- Skip link: "Skip to calendar grid" visible on Tab from top.

**ARIA**
- `CalendarGrid`: `role="grid"`, `aria-label="{viewName} view, {date}"`. Event chips: `role="gridcell"` with `aria-selected` on keyboard focus.
- `Sidebar`: `<nav aria-label="Calendar navigation">`.
- Mini-month: `role="grid"`, day buttons have `aria-label="{dayName}, {dateString}, {eventCount} events"`.
- View switcher: `role="tablist"` on desktop, `role="combobox"` on mobile dropdown.
- Calendar list checkboxes: native `<input type="checkbox">` with visible label.
- Undo toast: `role="status"` `aria-live="polite"`; Undo button is focusable.
- Reconnect banner: `role="alert"` `aria-live="assertive"`.
- All icons without text: `aria-label`.

**Keyboard**
- `Tab` order: header → sidebar → toolbar → grid → main actions.
- `c` → open create editor (only when focus not in input).
- `Esc` → close popover/editor/sheet/recurrence prompt.
- Arrow keys inside `CalendarGrid`: schedule-x default nav if provided; else stub (not required for v1 AA if mouse + editor work). Document in `Non-goals`.
- Editor: `Cmd/Ctrl+Enter` = Save, `Esc` = Cancel with unsaved-changes confirm.
- View switcher: left/right arrows cycle views (desktop tablist pattern).

**Contrast + sizing**
- All text ≥4.5:1 against background (AA normal).
- Focus ring ≥3:1, ≥2px outline.
- Event chip text: WCAG-pass against `backgroundColor` — compute per-event luminance; if ratio <4.5 use `foregroundColor` override or white/black fallback.
- Color is never the sole indicator of state (calendar toggle pairs color with checked state; recurrence shown with ↻ icon + label).

**Screen reader smoke**
- VoiceOver pass on macOS Safari + mobile Safari at end of step 23.

## Theme tokens (dark/light)

Defined in `src/app/globals.css` as CSS vars on `:root` and `[data-theme="dark"]`. Schedule-x theme vars mapped in `src/components/calendar/schedule-x-theme.css`.

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--cal-bg` | `#ffffff` | `#0b0b0d` | grid background |
| `--cal-surface` | `#ffffff` | `#111114` | sidebar, modals, popover |
| `--cal-surface-hover` | `#f4f4f5` | `#1a1a1f` | hover rows |
| `--cal-border` | `#e4e4e7` | `#27272a` | grid lines, dividers |
| `--cal-text` | `#09090b` | `#fafafa` | primary text |
| `--cal-text-muted` | `#71717a` | `#a1a1aa` | secondary text, day numbers |
| `--cal-accent` | `#1a73e8` | `#8ab4f8` | today highlight, primary buttons |
| `--cal-accent-fg` | `#ffffff` | `#0b0b0d` | text on accent |
| `--cal-focus-ring` | `#1a73e8` | `#8ab4f8` | outline color |
| `--cal-event-default-bg` | `#1a73e8` | `#8ab4f8` | fallback event color |
| `--cal-weekend-bg` | `#fafafa` | `#0e0e12` | Sat/Sun column tint |
| `--cal-now-indicator` | `#ea4335` | `#f28b82` | current-time line in Day/Week |
| `--cal-selection-bg` | `rgba(26,115,232,0.12)` | `rgba(138,180,248,0.18)` | drag range selection |
| `--cal-overlay` | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.6)` | modal backdrop |

Schedule-x mapping:
```css
.sx-react-calendar-wrapper {
  --sx-color-background: var(--cal-bg);
  --sx-color-surface: var(--cal-surface);
  --sx-color-on-surface: var(--cal-text);
  --sx-color-outline: var(--cal-border);
  --sx-color-primary: var(--cal-accent);
  --sx-color-on-primary: var(--cal-accent-fg);
  --sx-internal-color-text: var(--cal-text);
}
```

Google event colors: hardcoded palette map (`colorId` 1-11) in `src/lib/google/colors.ts` — matches Google's published palette; used when event has `colorId`. If no `colorId`, use owning calendar's `backgroundColor`.

## Data migration

Existing users have one of:

| State | `google_calendar_connected` | `google_tokens` | Required action |
|-------|-----------------------------|-----------------|-----------------|
| Never connected | `false` | `null` | Show Connect CTA on `/calendar` |
| Connected correctly | `true` | `{access_token, refresh_token, expires_at}` | Works immediately |
| Broken by prior sign-in bug (pre-9848d79) | `true` or `false` | `{access_token, refresh_token: null}` (provider_token only, no calendar scope) | Detect + force reconnect |

Detection (run at `/calendar` mount + in `useEvents` error handler):
- If first events fetch returns 403 `insufficientPermissions` OR 401 with no refresh token in row → set `google_calendar_connected = false` via `/api/google-calendar/disconnect`, show `ReconnectBanner`.
- No SQL migration needed. Existing `google_tokens` rows are left intact; next successful OAuth callback upserts with correct scoped tokens.

One-time Supabase SQL sanity check (run manually before launch):
```sql
-- users with truthy connected flag but missing refresh_token
SELECT id, email, google_calendar_connected,
       google_tokens->>'refresh_token' IS NOT NULL AS has_refresh
FROM users
WHERE google_calendar_connected = true
  AND (google_tokens->>'refresh_token') IS NULL;
```
These users will be forced to reconnect on next visit; expected and desired.

## Per-file skeletons

Signatures only — internals TBD during impl. Types in `src/lib/google/types.ts`.

```ts
// src/lib/google/types.ts
export interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  backgroundColor: string;
  foregroundColor: string;
  primary?: boolean;
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader';
  selected?: boolean;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  calendarColor: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end:   { dateTime?: string; date?: string; timeZone?: string };
  recurrence?: string[];
  recurringEventId?: string;
  attendees?: { email: string; responseStatus?: string }[];
  colorId?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: unknown;
  reminders?: { useDefault: boolean; overrides?: { method: 'popup' | 'email'; minutes: number }[] };
  status?: 'confirmed' | 'tentative' | 'cancelled';
}
```

```ts
// src/lib/google/calendar.ts
export async function fetchCalendars(): Promise<CalendarListEntry[]>;
export async function fetchEvents(params: { calendarIds: string[]; timeMin: Date; timeMax: Date }): Promise<CalendarEvent[]>;
export async function createEvent(calendarId: string, event: Partial<CalendarEvent> & { withMeet?: boolean }): Promise<CalendarEvent>;
export async function updateEvent(calendarId: string, eventId: string, patch: Partial<CalendarEvent>, updateScope?: 'single' | 'following' | 'all'): Promise<CalendarEvent>;
export async function deleteEvent(calendarId: string, eventId: string, updateScope?: 'single' | 'following' | 'all'): Promise<void>;
```

```ts
// src/lib/hooks/use-calendar.ts
export function useCalendars(): UseQueryResult<CalendarListEntry[]>;
export function useEvents(calendarIds: string[], timeMin: Date, timeMax: Date): UseQueryResult<CalendarEvent[]>;
export function useCreateEvent(): UseMutationResult<CalendarEvent, Error, { calendarId: string; event: Partial<CalendarEvent> }>;
export function useUpdateEvent(): UseMutationResult<CalendarEvent, Error, { calendarId: string; eventId: string; patch: Partial<CalendarEvent>; updateScope?: 'single'|'following'|'all' }>;
export function useDeleteEvent(): UseMutationResult<void, Error, { calendarId: string; eventId: string; updateScope?: 'single'|'following'|'all' }>;
export function useVisibleCalendars(): [string[], (ids: string[]) => void]; // localStorage-backed
```

```tsx
// src/app/calendar/layout.tsx
export default function CalendarLayout({ children }: { children: React.ReactNode }): JSX.Element; // wraps ReactQueryProvider

// src/app/calendar/page.tsx
export default async function CalendarPage(): Promise<JSX.Element>; // auth gate via createServerSupabaseClient

// src/components/calendar/CalendarShell.tsx
export interface CalendarShellProps {}
export default function CalendarShell(props: CalendarShellProps): JSX.Element;
// local state: sidebarOpen, currentDate, view, editor state, popover state

// src/components/calendar/Sidebar.tsx
export interface SidebarProps { open: boolean; onClose: () => void; onCreate: () => void; currentDate: Date; onDateChange: (d: Date) => void; }
export default function Sidebar(p: SidebarProps): JSX.Element;

// src/components/calendar/MiniMonth.tsx
export interface MiniMonthProps { date: Date; onDateChange: (d: Date) => void; compact?: boolean; }

// src/components/calendar/CalendarGrid.tsx
export interface CalendarGridProps { view: 'day'|'week'|'month'|'year'|'schedule'; date: Date; calendarIds: string[]; onEventClick: (e: CalendarEvent, anchor: DOMRect) => void; onSlotSelect: (start: Date, end: Date) => void; }

// src/components/calendar/YearView.tsx
export interface YearViewProps { year: number; onDateSelect: (d: Date) => void; }

// src/components/calendar/EventPopover.tsx
export interface EventPopoverProps { event: CalendarEvent; anchor: DOMRect | null; open: boolean; onClose: () => void; onEdit: () => void; onDelete: () => void; onDuplicate: () => void; }

// src/components/calendar/EventEditorModal.tsx
export interface EventEditorModalProps { open: boolean; mode: 'create'|'edit'; initial?: Partial<CalendarEvent>; defaultCalendarId?: string; onClose: () => void; onSaved: (e: CalendarEvent) => void; }

// src/components/calendar/RecurrenceBuilder.tsx
export interface RecurrenceBuilderProps { value: string | null; startDate: Date; onChange: (rrule: string | null) => void; }

// src/components/calendar/RecurrencePrompt.tsx
export type RecurrenceScope = 'single' | 'following' | 'all';
export interface RecurrencePromptProps { open: boolean; action: 'edit'|'delete'; onChoose: (scope: RecurrenceScope) => void; onCancel: () => void; }

// src/components/calendar/GuestsInput.tsx
export interface GuestsInputProps { value: string[]; onChange: (emails: string[]) => void; }

// src/components/calendar/UndoToast.tsx
export interface UndoToastPayload { message: string; undo: () => Promise<void>; }
export function showUndoToast(payload: UndoToastPayload): void; // wraps react-hot-toast

// src/components/calendar/ReconnectBanner.tsx
export default function ReconnectBanner(): JSX.Element | null; // reads global query error state
```

## Steps

### 1. Install dependencies + verify build

- `bun add @schedule-x/react@^2 @schedule-x/calendar@^2 @schedule-x/drag-and-drop@^2 @schedule-x/event-modal@^2 @schedule-x/theme-default rrule@^2 @tanstack/react-query@^5 @tanstack/react-query-devtools@^5`
- `bun run build` — confirm Next 16 + schedule-x compatibility (schedule-x ships ESM; may need `transpilePackages` in `next.config.ts`).

**Verify:** build passes, no type errors.

### 2. Scaffold `/calendar` route + React Query provider

Files:
- `src/app/calendar/layout.tsx` — wraps children in `QueryClientProvider` (SSR-safe: instantiate `QueryClient` in `useState` initializer inside `'use client'` provider component).
- `src/components/providers/ReactQueryProvider.tsx` — client component with devtools in dev.
- `src/app/calendar/page.tsx` — auth gate (redirect to `/` if no user), render `<CalendarShell />`.

**Verify:** `/calendar` loads, shows auth gate correctly, redirects unauthed.

### 3. API: `GET /api/calendar/calendars`

File: `src/app/api/calendar/calendars/route.ts`

- Service role client reads `google_tokens` from `users` table.
- Proactive refresh if `expires_at < now + 5min`; persist new tokens.
- Call `GET https://www.googleapis.com/calendar/v3/users/me/calendarList`.
- Return array: `{id, summary, backgroundColor, foregroundColor, primary, accessRole, selected}`.
- On 401 after refresh attempt → `{reconnectRequired: true}` + clear `google_calendar_connected`.

**Verify:** curl with user cookie returns calendar list.

### 4. API: Refactor `GET /api/calendar/events` for multi-calendar

File: `src/app/api/calendar/events/route.ts`

- Accept `calendarIds` (CSV), `timeMin`, `timeMax`.
- `Promise.all` over selected calendars.
- For each event, attach `calendarId`, `calendarColor` (looked up from calendarList response cached per-request).
- `singleEvents=true`, `orderBy=startTime`, `maxResults=2500`.
- Return `{events: [...]}`.

**Verify:** passing 2 calendar IDs returns merged events, each tagged with `calendarId`.

### 5. API: `POST /api/calendar/events`

Same file, `POST` handler.

- Body: `{calendarId, summary, description, location, start, end, recurrence?, attendees?, reminders?, colorId?, conferenceData?}`.
- Query param `conferenceDataVersion=1` if body includes `conferenceData.createRequest`.
- Forward to `POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`.
- Return created event.

**Verify:** POST creates event in Google Calendar, response matches posted shape.

### 6. API: `PATCH /api/calendar/events/[id]`

File: `src/app/api/calendar/events/[id]/route.ts`

- Query: `calendarId`, `updateScope` (`single` | `following` | `all`, default `single`).
- `single`: PATCH `/calendars/{calendarId}/events/{id}` where `id` = instance id.
- `following`: fetch master, set `UNTIL=<instance-1>` on its RRULE, PATCH master; create new event from instance with new RRULE.
- `all`: strip instance suffix from `id` to get master, PATCH master.
- `conferenceDataVersion=1` always (cheap, ensures Meet data persists).

**Verify:** drag event → PATCH succeeds; recurring edit `following` splits series.

### 7. API: `DELETE /api/calendar/events/[id]`

Same file, `DELETE` handler. Mirror PATCH scope logic for recurring:
- `single`: DELETE instance.
- `following`: PATCH master with `UNTIL`, no new series.
- `all`: DELETE master.

**Verify:** single delete removes one instance; all delete removes whole series.

### 8. `src/lib/google/calendar.ts` — fetch wrappers

Client-side typed wrappers around the 5 API routes. Used by React Query hooks.

### 9. React Query hooks

File: `src/lib/hooks/use-calendar.ts`

- `useCalendars()` → `['calendars']`, stale 5 min.
- `useEvents(calendarIds, timeMin, timeMax)` → `['events', ...]`, stale 30 s.
- `useCreateEvent()`, `useUpdateEvent()`, `useDeleteEvent()` with `onMutate` optimistic snapshot + rollback on error.

**Verify:** hook types compile; calendar list renders in a throwaway test component.

### 10. `CalendarShell.tsx` — layout + responsive sidebar

- CSS Grid: `grid-cols-[auto_1fr]` on `lg+`, `grid-cols-1` below.
- Sidebar visibility state: `{open: boolean}`.
- Mobile (`<md`): sidebar is `Sheet` from shadcn or headless drawer; hamburger button in toolbar toggles.
- Tablet (`md`): sidebar toggleable, default open.
- Desktop (`lg+`): sidebar persistent open by default, toggle hides.
- Touch: swipe-from-left on mobile opens drawer (defer if too big — click-only v1 acceptable).

**Verify:** resize window across breakpoints — sidebar behavior matches table; hamburger only visible `<lg`.

### 11. Toolbar: date nav + view switcher

Inside `CalendarShell`:
- Left: `Today` button, `<` `>` arrows (calls `next`/`prev` on schedule-x), current period label.
- Right: view switcher.
  - `md+`: segmented control `[Day | Week | Month | Year | Schedule]`.
  - `<md`: dropdown with same 5 options.
- State lifted here; passed to `CalendarGrid` as controlled `view` prop.

**Verify:** switching view re-renders grid; prev/next advance correct unit per view.

### 12. `Sidebar.tsx` — Create button + MiniMonth + calendar list

- `Create` button (top): opens `EventEditorModal` in create mode. Mobile: floating action button in bottom-right instead of inside sidebar (sidebar hidden).
- `MiniMonth`: clicking date jumps main view to that date. Shows dot under dates with events (future enhancement — v1 just navigates).
- Calendar list: checkbox per calendar, uses `backgroundColor` swatch. Toggles persist in `localStorage['calendar.visibleCalendars']`.

**Verify:** toggling calendar hides/shows events in main grid; mini-month click navigates; create FAB visible only `<md`.

### 13. `CalendarGrid.tsx` — schedule-x integration (Day/Week/Month/Schedule)

- Instantiate `createCalendar` with plugins: `createDragAndDropPlugin`, `createEventModalPlugin` (or skip modal plugin, use our own popover).
- Map events from React Query → schedule-x event shape.
- Event click handler → opens `EventPopover` at click coordinates.
- `onEventUpdate` callback (drag/resize) → calls `useUpdateEvent` mutation.
- Theme: import `@schedule-x/theme-default` + override CSS vars to match app (dark/light).

**Responsive:**
- `<md`: Day view is default. Lock to Day or Schedule (Month/Week too cramped). Update view switcher to disable/hide Month/Week/Year `<md`.
- `md+`: all views available.

**Verify:** all enabled views render; drag moves event and persists; resize changes duration and persists; event click opens popover.

### 14. `YearView.tsx` — custom 12-month grid

schedule-x has no year view. Custom component:
- Grid of 12 mini-months (3×4 on `lg+`, 2×6 on `md`, 1×12 scroll on `<md`).
- Each mini-month: reuse `MiniMonth.tsx` internals in read-only mode, show density dot per day.
- Click day → switch to Day view for that date.

**Verify:** year view renders 12 months, click navigates to day.

### 15. `EventPopover.tsx`

- Anchored popover on `md+` (Radix `Popover`).
- Bottom sheet on `<md` (Radix `Dialog` with bottom positioning, full-width).
- Shows: title, time range, location, description (truncated), calendar name + color dot, Meet link if present.
- Actions: `Edit`, `Delete`, `Duplicate`.
- Delete → if recurring, open `RecurrencePrompt`; else confirm-via-undo (no modal, just optimistic delete + undo toast).

**Verify:** click event on desktop shows popover; mobile shows sheet; Edit opens editor in edit mode.

### 16. `EventEditorModal.tsx` — full editor

Sections:
1. Title (big input).
2. Date/time row — start, end, all-day toggle, timezone (read-only, user's tz).
3. Recurrence — `Does not repeat` dropdown → presets → `Custom...` → opens `RecurrenceBuilder`.
4. Guests (`GuestsInput`): email chip input.
5. Location (text).
6. Meet toggle + link preview (after save).
7. Description (textarea).
8. Color picker (11 Google colors + "default calendar color").
9. Calendar picker (writable only).
10. Reminders: list with add/remove (email or popup, minutes before).

Layout:
- `md+`: centered modal, max-w-2xl, scrollable body.
- `<md`: full-screen sheet (top bar: Cancel | Save; body scrolls).

**Verify:** all fields round-trip through POST/PATCH; validation (end > start); all-day toggles date-only inputs.

### 17. `RecurrenceBuilder.tsx` + RRULE handling

- Presets: Daily, Weekly on {days of week}, Monthly on date N, Monthly on Nth weekday, Yearly on MM-DD, Custom.
- Custom: interval, BYDAY, UNTIL | COUNT | forever.
- Uses `rrule` lib to build/parse RRULE strings.
- Output: `recurrence: ['RRULE:...']` in event payload.

**Verify:** each preset produces a valid RRULE that Google Calendar accepts; custom builder round-trips.

### 18. `RecurrencePrompt.tsx`

Dialog on edit/delete of recurring event:
- `This event` / `This and following events` / `All events` / `Cancel`.
- Returns selected scope → parent mutates with that `updateScope`.

**Verify:** each choice produces correct API call per step 6/7.

### 19. `GuestsInput.tsx`

- Email chip input. Enter/comma/blur commits chip.
- Validate email on commit; red chip if invalid.
- Autocomplete from `people.searchContacts` (deferred — v1: no autocomplete, raw email input only; doc in Non-goals supplement).

**Verify:** multi-chip entry, chip delete, paste CSV splits.

### 20. `UndoToast.tsx` + undo flow

- After successful mutation, render toast: "Event deleted. [Undo]" / "Event moved. [Undo]" / etc.
- 6 s auto-dismiss. Click Undo → PATCH/POST to reverse (store previous event snapshot in toast state).
- Uses existing `react-hot-toast` (already in deps).

**Verify:** delete → undo restores; drag → undo returns event to prior slot.

### 21. Error handling: reconnect banner

- Component: `src/components/calendar/ReconnectBanner.tsx`.
- Shown at top of `CalendarShell` when any query returns `reconnectRequired: true`.
- Button: "Reconnect to Google Calendar" → calls existing `/api/google-calendar/authorize` → redirect.
- Hide while connected.

**Verify:** revoke token manually → banner appears; reconnect restores access.

### 22. Delete `LiveCalendarView` + `EmbeddedCalendarView` + embed-url route

- Delete `src/components/LiveCalendarView.tsx`, `src/components/EmbeddedCalendarView.tsx`, `src/app/api/calendar/embed-url/route.ts`.
- Update `src/app/scan/page.tsx`: remove `LiveCalendar`/`Embedded` tabs, or redirect both to `/calendar`.
- Update header nav: `Calendar` link points to `/calendar` (already does per current nav — verify).
- Redirect `/scan#live-calendar` → `/calendar` via `useEffect` hash-check in `scan/page.tsx` for back-compat of bookmarks.

**Verify:** no dead imports; old routes return 404 or redirect.

### 23. Responsive QA pass

Playwright resize sweep: 360×640, 768×1024, 1024×768, 1440×900, 1920×1080.
Per size, verify:
- Sidebar behavior correct per table.
- Toolbar layout not overflowing.
- Event popover/sheet positioned correctly.
- Editor modal/sheet full readable, no scroll trap.
- Touch targets ≥44px on 360 width.
- View switcher accessible (dropdown on mobile, segmented on desktop).

**Verify:** screenshot each, visually inspect, no horizontal scroll.

### 24. E2E test script (manual/scripted)

Run through spec's 10-step Playwright flow on deployed preview. Document pass/fail per step.

### 25. Merge prep

- Squash/clean commits on branch.
- Update `docs/google-calendar-auth-fix.md` with note: "LiveCalendarView deleted, replaced by `/calendar`."
- Open PR against `main` with summary linking spec + plan.

## Dependencies + risks

| Risk | Mitigation |
|------|------------|
| schedule-x v2 Next.js 16 incompatibility | Pin exact version; fall back to `react-big-calendar` if dealbreaker (rewrite ~2 steps) |
| Google `events.list` pagination on large calendars | Set `maxResults=2500`; handle `nextPageToken` in step 4 |
| RRULE edge cases (timezone, DST, UNTIL format) | Use `rrule` lib; convert UNTIL to UTC `Z` per RFC 5545 |
| Optimistic rollback complexity on recurring edits | Keep rollback simple: invalidate full event list on error for recurring; accept short refetch |
| Vercel function timeout on multi-calendar fetch | Parallel `Promise.all` + per-calendar timeout 8 s; return partial results + error flags per calendar |
| Mobile drag collisions with scroll | schedule-x handles via long-press; confirm in step 13 QA; fall back to tap-to-edit if broken |
| Deleting legacy components breaks scan page tabs | Step 22 explicit: update scan/page.tsx imports |

## Non-goals (v1, confirmed from spec)

- Offline queue / IndexedDB cache
- Tasks integration
- Appointment slots / bookable hours
- World clock / time-zone overlay
- Keyboard shortcuts beyond `c`
- Shared-calendar ACL editing
- Contact autocomplete in GuestsInput (raw email only)

## Done = merged when

- All 25 steps verified.
- Build passes on Vercel preview.
- 10-step E2E flow from spec passes on preview.
- Responsive QA pass (step 23) done on 5 viewport sizes.
- Old LiveCalendarView + EmbeddedCalendarView files removed.
- PR description links spec + plan + preview URL + screenshots per viewport.

---

# Hardening Addendum

Integration rules: items tagged `[before N]` run before existing Step N; `[in N]` modify that step; `[after N]` appended. Net effect: 25 original steps → 31 steps with pre-flight gates and post-launch monitoring.

## A. Pre-flight gates `[before 1]`

### A.1 Supabase RLS audit (new Step 0.1)

Run in Supabase SQL editor, paste output into plan PR description:
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users';
```

Required policies:
- `SELECT` for `authenticated`: `auth.uid() = id` (own row only).
- `UPDATE/INSERT/DELETE`: `service_role` only, OR blocked for `authenticated`.

If SELECT allows cross-row reads, document as known risk and ship anyway; service_role reads in events route are unaffected. If UPDATE is open to `authenticated`, fail-stop: fix RLS before proceeding.

### A.2 schedule-x Schedule view verification (new Step 0.2)

```ts
// scratch/verify-sx.tsx
import { createScheduleView } from '@schedule-x/calendar';
```
Import succeeds → keep Schedule in view list. Fails → build custom agenda: flat `events.filter(e => inRange(e, timeMin, timeMax)).sort(byStart)` rendered as list grouped by day. Document choice in step 13.

### A.3 Bundle baseline (new Step 0.3)

`bun run build` on current `main` branch → capture `.next/analyze` or Route Segment sizes. Compare post-impl. Hard cap: `+250KB` gzipped for `/calendar`. If exceeded, revisit schedule-x (swap for `react-big-calendar` ~60KB smaller) before merge.

### A.4 Vitest setup (new Step 0.4)

```sh
bun add -d vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```
`vitest.config.ts` with jsdom env. `package.json`: `"test": "vitest"`, `"test:ci": "vitest run"`. CI runs on PR.

## B. Security `[in 3-8, 22]`

### B.1 CSRF middleware `[before 3]`

`src/middleware.ts` (new or extend existing):
```ts
export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/calendar')) return NextResponse.next();
  if (!['POST','PATCH','DELETE','PUT'].includes(req.method)) return NextResponse.next();
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'same-site') {
    return NextResponse.json({ error: 'cross-site' }, { status: 403 });
  }
  return NextResponse.next();
}
export const config = { matcher: '/api/calendar/:path*' };
```
Old browsers lacking `Sec-Fetch-Site` pass (site === null); acceptable — modern UA coverage ~98%.

### B.2 Service-role-key build guard `[after 1]`

`scripts/check-no-service-key.mjs`:
```js
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.log('no key to check'); process.exit(0); }
const walk = d => readdirSync(d).flatMap(f => {
  const p = join(d,f); return statSync(p).isDirectory() ? walk(p) : [p];
});
const bad = walk('.next/static').filter(p => /\.(js|map)$/.test(p) && readFileSync(p,'utf8').includes(key));
if (bad.length) { console.error('SERVICE ROLE KEY LEAKED:', bad); process.exit(1); }
console.log('service role key not in client bundle');
```
`package.json`: `"postbuild": "node scripts/check-no-service-key.mjs"`.

### B.3 Content sanitization `[in 15, 16]`

Rendering rules added to `EventPopover` + `EventEditorModal`:
- `summary`, `description`, `location`: JSX text (React escapes). No `dangerouslySetInnerHTML`. No `marked`/`remark` v1.
- `hangoutLink`: before rendering as `<a href>`, validate:
  ```ts
  const isMeetUrl = (s?: string) =>
    !!s && /^https:\/\/meet\.google\.com\/[a-z0-9-]{8,}$/i.test(s);
  ```
  Fail → render as plain text, no anchor.
- Attendee emails: display only if `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Invalid → skip chip.

## C. Auth + concurrency `[in 3-7]`

### C.1 Token refresh advisory lock `[in 3, 4, 5, 6, 7]`

Shared helper `src/lib/google/token-manager.ts`:
```ts
export async function getFreshAccessToken(userId: string): Promise<string> {
  const sb = await createServiceRoleClient();
  const lockKey = hashToBigInt(`gcal_refresh_${userId}`);
  await sb.rpc('pg_advisory_xact_lock', { key: lockKey }); // inside a transaction OR use pg_try_advisory_lock with retry
  // re-read tokens inside lock (another request may have refreshed)
  const { data } = await sb.from('users').select('google_tokens').eq('id', userId).single();
  const { access_token, refresh_token, expires_at } = data.google_tokens;
  if (expires_at - Date.now() > 5*60*1000) return access_token;
  // refresh
  const refreshed = await refreshGoogleToken(refresh_token);
  await sb.from('users').update({ google_tokens: { access_token: refreshed.access_token, refresh_token, expires_at: Date.now()+refreshed.expires_in*1000 }}).eq('id', userId);
  return refreshed.access_token;
}
```
If Supabase `rpc('pg_advisory_xact_lock')` unavailable in serverless context, degrade to `pg_try_advisory_lock` + 200ms spinwait × 5; fallback to unlocked refresh on timeout (Google tolerates double-refresh; older refresh_token may invalidate — accept and force reconnect if next call fails).

All 5 API routes call `getFreshAccessToken(user.id)` instead of inline refresh.

### C.2 Pagination loop `[in 4]`

```ts
async function listAllEvents(calendarId, params) {
  const out: CalendarEvent[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 5; i++) {
    const res = await googleFetch(`/calendars/${calendarId}/events`, {
      ...params, maxResults: 2500, pageToken, singleEvents: true,
      orderBy: 'startTime', showDeleted: false,
    });
    out.push(...res.items);
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  return { events: out, truncated: !!pageToken };
}
```
Merge route: if any calendar returns `truncated: true`, include `{ warnings: ['partial_results'] }` in response. Client shows banner "Showing first 12,500 events — narrow date range for more."

### C.3 Explicit events.list params `[in 4]`

Always send: `singleEvents=true`, `orderBy=startTime`, `showDeleted=false`, `maxResults=2500`. No implicit defaults.

## D. Data model `[in 5-7, 16, 17]`

### D.1 RRULE split helper + unit tests `[in 6, 7]`

New file `src/lib/rrule/split.ts`:
```ts
import { RRule } from 'rrule';
export function splitSeries(masterRRule: string, instanceDate: Date):
  { oldRRule: string; newRRule: string; newDtStart: Date } {
  const rule = RRule.fromString(masterRRule);
  const opts = { ...rule.origOptions };
  // If COUNT, convert to UNTIL first (count occurrences up to but excluding instanceDate)
  if (opts.count != null) {
    const all = rule.all();
    const before = all.filter(d => d < instanceDate);
    opts.count = before.length;  // old series: stop at COUNT
  }
  // Set UNTIL = instanceDate - 1ms for old series (exclusive)
  const untilForOld = new Date(instanceDate.getTime() - 1000);
  const oldOpts = { ...opts, until: untilForOld, count: undefined };
  const oldRRule = new RRule(oldOpts).toString();
  // New series starts at instanceDate; preserve original freq/byday etc.
  const newOpts = { ...rule.origOptions, dtstart: instanceDate, count: undefined, until: undefined };
  // Trim remaining COUNT if original had one
  if (rule.origOptions.count != null) {
    const remaining = rule.all().filter(d => d >= instanceDate).length;
    newOpts.count = remaining;
  }
  const newRRule = new RRule(newOpts).toString();
  return { oldRRule, newRRule, newDtStart: instanceDate };
}
```

Unit tests (new Step 23.5 below) cover:
- Weekly with COUNT=10, split at occurrence 4 → old COUNT=3, new COUNT=7
- Weekly with UNTIL=X, split at occurrence Y < X → old UNTIL=Y-1ms, new UNTIL=X
- Monthly BYDAY=2TU, split at occurrence 3 → preserves BYDAY in new
- Daily no-end, split midway → old UNTIL=Y-1ms, new no-end
- DTSTART drift: first occurrence must match new DTSTART

### D.2 Timezone preservation `[in 5, 6]`

On PATCH:
```ts
// Never strip existing timeZone; always round-trip the incoming value
body.start.timeZone = patch.start?.timeZone ?? existing.start.timeZone;
body.end.timeZone   = patch.end?.timeZone   ?? existing.end.timeZone;
```
Display: all datetime fields rendered via `Intl.DateTimeFormat(undefined, { timeZone: event.start.timeZone ?? browserTz, ... })`. User-tz-vs-event-tz mismatch shown as secondary caption in popover: "`{timeString}` in your time — event set for `{eventTz}`".

All-day events: `start.date` / `end.date` only; do not add `timeZone`.

### D.3 Attendee self-strip `[in 5, 6]`

Before POST/PATCH:
```ts
body.attendees = (body.attendees ?? []).filter(a => a.email.toLowerCase() !== user.email.toLowerCase());
```
Google auto-adds organizer; duplicate causes 400.

### D.4 Reminders tri-state `[in 16]`

UI radio: `Use default` | `Custom` | `None`.
```ts
type ReminderMode = 'default' | 'custom' | 'none';
function toPayload(mode: ReminderMode, overrides: ReminderOverride[]): Reminders {
  if (mode === 'default') return { useDefault: true };
  if (mode === 'custom') return { useDefault: false, overrides };
  return { useDefault: false, overrides: [] };
}
```

### D.5 Non-owned-calendar 403 fallback `[in 5, 6]`

On POST/PATCH, if response is 403 with `guestPermissionDenied` or similar reason and `attendees.length > 0`:
```ts
// retry without attendees
body.attendees = undefined;
const retry = await googleFetch(...body);
return { ...retry, warning: 'guests_not_allowed' };
```
Client toast: "This calendar doesn't allow adding guests — event saved without them."

## E. Mutation hardening `[in 9]`

### E.1 Optimistic snapshot from variables

Mutation shape:
```ts
type UpdateVars = { calendarId: string; eventId: string; patch: Partial<CalendarEvent>; previous: CalendarEvent };
useUpdateEvent = useMutation({
  mutationFn: ({calendarId, eventId, patch}) => updateEvent(calendarId, eventId, patch),
  onMutate: async (vars) => {
    await qc.cancelQueries({queryKey: ['events']});
    // Roll-back source = vars.previous (caller-supplied), not cache
    qc.setQueryData(['event', vars.calendarId, vars.eventId], {...vars.previous, ...vars.patch});
    return { previous: vars.previous };
  },
  onError: (_err, vars, ctx) => {
    if (ctx?.previous) qc.setQueryData(['event', vars.calendarId, vars.eventId], ctx.previous);
    qc.invalidateQueries({queryKey: ['events']});
  },
  onSettled: (_res, _err, vars) => {
    qc.invalidateQueries({queryKey: ['events']});
    qc.invalidateQueries({queryKey: ['event', vars.calendarId, vars.eventId]});
  },
});
```
Caller passes `previous` from the event they clicked on — not from cache. Immune to concurrent-mutation staleness.

### E.2 Undo toast stacking `[in 20]`

```ts
let activeUndoId: string | null = null;
export function showUndoToast({ message, undo }: UndoToastPayload) {
  if (activeUndoId) toast.dismiss(activeUndoId);
  activeUndoId = toast.custom(<UndoToastUI message={message} onUndo={async () => {
    toast.dismiss(activeUndoId!); activeUndoId = null; await undo();
  }} />, { duration: 6000 });
}
```
Last-wins; new undo dismisses prior (prior mutation becomes permanent).

## F. Rendering `[in 14, 2]`

### F.1 YearView density-only `[in 14]`

Render each day as `<button>` with `backgroundColor: hsla(accent, ${intensity})` where `intensity = min(1, eventCount/5)`. No chips, no text beyond day number. Click → switch to Day view for that date. Scrolls vertically on mobile (1 col × 12 rows).

### F.2 HydrationBoundary prefetch `[in 2]`

`src/app/calendar/page.tsx` becomes async Server Component:
```tsx
export default async function CalendarPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');
  const qc = new QueryClient();
  const timeMin = startOfWeek(new Date());
  const timeMax = endOfWeek(new Date());
  await Promise.all([
    qc.prefetchQuery({ queryKey: ['calendars'], queryFn: () => fetchCalendarsServer(user.id) }),
    qc.prefetchQuery({ queryKey: ['events', 'primary', timeMin.toISOString(), timeMax.toISOString()],
                       queryFn: () => fetchEventsServer(user.id, ['primary'], timeMin, timeMax) }),
  ]);
  return <HydrationBoundary state={dehydrate(qc)}><CalendarShell /></HydrationBoundary>;
}
```
Server-side `fetchCalendarsServer` / `fetchEventsServer` use `getFreshAccessToken` directly, no HTTP hop. First paint has data.

## G. Rollout `[restructures 22, adds 24.5, 26, 27]`

### G.1 Feature flag `[replaces 22]`

- Env: `NEXT_PUBLIC_NEW_CALENDAR` (set to `1` on preview + prod after QA).
- `scan/page.tsx`: if flag set, redirect `/scan#live-calendar` to `/calendar`; else render old `LiveCalendarView`.
- Header `Calendar` nav link: always `/calendar` (new route always mounted; old view still works if flag unset — user reaches it only via tab or old bookmark).
- Rollout plan: merge with flag unset → enable on staging → enable in prod → monitor → delete legacy.

### G.2 Telemetry wiring (new Step 24.5)

`src/lib/telemetry.ts`:
```ts
import { track } from '@vercel/analytics';
export function tel(event: string, props?: Record<string, string | number | boolean>) {
  try { track(event, props); } catch { /* swallow */ }
}
```
Events emitted:
- `calendar.view.shown` `{view}`
- `calendar.event.create.ok|err` `{calendarId, hasMeet}`
- `calendar.event.update.ok|err` `{scope, kind: drag|resize|modal}`
- `calendar.event.delete.ok|err` `{scope}`
- `calendar.reconnect.shown|clicked`
- `calendar.refresh.ok|revoked|network_err`
- `calendar.pagination.truncated` `{calendarCount}`
- `calendar.guest_permission_denied` `{retried: true}`

### G.3 48h monitor before legacy delete (new Step 26)

Post-launch: enable flag in prod. Monitor:
- `calendar.event.*.err` rate < 2%.
- `calendar.reconnect.shown` rate < 5% weekly actives.
- Vercel runtime error rate < baseline + 0.5%.
- Zero 500s from `/api/calendar/*` for 48h.

If clean → proceed to Step 27. If not → rollback: unset flag in Vercel, re-emerge on a fix branch.

### G.4 Delete legacy (new Step 27, replaces old 22's delete phase)

Only after G.3 green:
- Delete `src/components/LiveCalendarView.tsx`, `src/components/EmbeddedCalendarView.tsx`, `src/app/api/calendar/embed-url/route.ts`.
- Remove `Upload | Events | Live Calendar | Embedded` tab switcher from `scan/page.tsx`; keep Upload + Events only, or redirect fully to separate routes.
- Remove flag check; `/calendar` is canonical.

### G.5 Rollback runbook (new Step 28)

Fast rollback if prod breaks:
1. Vercel dashboard → env vars → unset `NEXT_PUBLIC_NEW_CALENDAR` → redeploy (no code revert needed).
2. If data corruption: `UPDATE users SET google_tokens = NULL, google_calendar_connected = false WHERE <affected>` → users forced to reconnect.
3. Post-mortem: capture `calendar.*.err` telemetry window, file follow-up.

## Step renumbering

| Old | New | Notes |
|-----|-----|-------|
| — | 0.1–0.4 | Pre-flight (A.1–A.4) |
| 1 | 1 | + B.2 postbuild guard |
| 2 | 2 | + F.2 HydrationBoundary |
| 3–7 | 3–7 | + C.1 token manager, C.2 pagination, C.3 params, D.2 tz, D.3 self-strip, D.5 guest-fallback |
| 8–13 | 8–13 | unchanged |
| 14 | 14 | + F.1 density-only |
| 15–20 | 15–20 | + B.3 sanitization (15,16), D.1 split helper (16), D.4 reminders (16), E.1 vars-snapshot (9 area), E.2 stacking (20) |
| 21 | 21 | unchanged |
| 22 | — | replaced by G.1 feature flag gate |
| — | 22 | G.1 flag wiring |
| 23 | 23 | unchanged |
| — | 23.5 | Unit tests (Vitest): RRULE split + token refresh + tz conversion |
| 24 | 24 | unchanged |
| — | 24.5 | G.2 telemetry |
| 25 | 25 | unchanged (PR merge with flag unset) |
| — | 26 | G.3 48h monitor |
| — | 27 | G.4 delete legacy |
| — | 28 | G.5 rollback runbook documented in repo |

Final step count: 0.1–0.4 + 1–28 = **32 numbered checkpoints**.

## Hardening done = merged when

- All 32 checkpoints verified.
- RLS audit output attached to PR.
- Bundle delta < 250KB gz.
- `postbuild` service-key check passes on CI.
- Vitest suite green (RRULE split + token refresh + tz).
- 48h prod monitor green before G.4 delete.
- Rollback runbook validated (at least once by manually unsetting flag on preview).

