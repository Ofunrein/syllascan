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
