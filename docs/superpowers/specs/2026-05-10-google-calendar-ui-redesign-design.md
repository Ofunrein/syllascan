# Google Calendar-Style Live View — Design Spec

**Date:** 2026-05-10
**Branch:** `google-calendar-ui-redesign`
**Status:** Draft, pending implementation plan

## Goal

Replace the current Live Calendar (view-only custom render) and Embedded Calendar (Google iframe) with a single unified interactive calendar that visually and functionally mirrors Google Calendar, backed by the Google Calendar API. Users can create, edit, delete, drag, and resize events directly — no iframe, no post-sync gap.

## Decisions

| # | Topic | Choice |
|---|-------|--------|
| 1 | View scope | Unified Google-style view replacing Live + Embedded |
| 2 | View modes | Day, Week, Month, Year, Schedule (agenda) — all 5 |
| 3 | Create trigger | Create button + click empty slot + drag range on Day/Week |
| 4 | Event click | Quick popover with inline Edit/Delete |
| 5 | Editor fields | Full Google parity: title, time, all-day, location, description, color, guests, recurrence, reminders, calendar picker, Google Meet |
| 6 | Drag/resize | Full — drag to move, resize to change duration, Month cell drag to change date |
| 7 | UI library | `schedule-x` (`@schedule-x/react`) |
| 8 | Sidebar | Full sidebar (mini-month, Create, calendar list), collapsible on mobile |
| 9 | Multi-calendar | Full support: list all, toggle visibility, write to any writable calendar |
| 10 | Mutations | Optimistic + Gmail-style undo toast |

## Architecture

### Route

Single new route: `/calendar` (App Router). Replaces both existing calendar views. `/scan#live-calendar` anchor redirects to `/calendar`.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header (existing)                                          │
├──────────┬──────────────────────────────────────────────────┤
│          │  Toolbar: Today  < >  May 2026  [Day|Wk|Mo|Yr|S] │
│ Sidebar  ├──────────────────────────────────────────────────┤
│          │                                                  │
│ [Create] │                                                  │
│          │             Calendar Grid                        │
│ MiniMo.  │             (schedule-x)                         │
│          │                                                  │
│ My cals  │                                                  │
│ ☑ Primary│                                                  │
│ ☑ Birthd.│                                                  │
│ Other    │                                                  │
│ ☐ Holida.│                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

Mobile: sidebar collapsed, hamburger toggle. Toolbar condenses (view switcher → dropdown).

### Components

| File | Purpose |
|------|---------|
| `src/app/calendar/page.tsx` | Route shell, auth gate, React Query provider |
| `src/components/calendar/CalendarShell.tsx` | Layout, sidebar toggle, toolbar |
| `src/components/calendar/Sidebar.tsx` | Create button, mini-month, calendar list |
| `src/components/calendar/MiniMonth.tsx` | Small month picker, syncs w/ main view date |
| `src/components/calendar/CalendarGrid.tsx` | Wraps schedule-x, handles drag/resize/click events |
| `src/components/calendar/YearView.tsx` | Custom 12-month grid (schedule-x has no year view) |
| `src/components/calendar/EventPopover.tsx` | Click-chip popover: title/time/location/color/Edit/Delete/Duplicate |
| `src/components/calendar/EventEditorModal.tsx` | Full editor: all Google-parity fields |
| `src/components/calendar/RecurrenceBuilder.tsx` | RRULE builder (daily/weekly/monthly/yearly/custom) |
| `src/components/calendar/GuestsInput.tsx` | Email chip input, contact autocomplete |
| `src/components/calendar/UndoToast.tsx` | 6s undo window, re-PATCH on click |
| `src/components/calendar/RecurrencePrompt.tsx` | "This / This+following / All" dialog on edit/delete of recurring event |
| `src/lib/google/calendar.ts` | Fetch wrappers for Calendar API |

### API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/calendar/calendars` | `calendarList.list` — all user calendars |
| GET | `/api/calendar/events` | Params: `calendarIds`, `timeMin`, `timeMax`. Merges events from all selected calendars. |
| POST | `/api/calendar/events` | Body: `calendarId`, event resource. Creates event (with `conferenceDataVersion=1` if Meet). |
| PATCH | `/api/calendar/events/[id]` | Query: `calendarId`, `updateScope` (single/following/all for recurring). Updates event. |
| DELETE | `/api/calendar/events/[id]` | Query: `calendarId`, `updateScope`. Deletes. |

All routes:
- Use `createServiceRoleClient()` to read tokens from `users.google_tokens` (bypasses RLS).
- Proactive refresh when `expires_at < now + 5min` via stored `refresh_token`.
- On 401 → clear `google_calendar_connected`, return `{ reconnectRequired: true }`.

### State management

- **React Query** for events + calendar list. Query keys: `['calendars']`, `['events', calendarIds, timeMin, timeMax]`.
- **Optimistic mutations**: `onMutate` snapshots cache + updates UI; `onError` rolls back; `onSettled` invalidates.
- **Undo toast**: after success, store `{ action, previousState, eventId }` in toast state. Click "Undo" → PATCH back to previous state. 6s auto-dismiss.

### Recurrence handling

- Editor uses RFC 5545 RRULE strings. Builder presets: daily, weekly on {days}, monthly on date, monthly on nth weekday, yearly, custom.
- Edit/delete of recurring instance → `RecurrencePrompt`:
  - **This event only**: PATCH/DELETE instance by `instance.id` (includes `_YYYYMMDDTHHMMSSZ` suffix).
  - **This and following**: split series — set `UNTIL` on original RRULE, create new series from this instance.
  - **All events**: PATCH/DELETE master event.

### Multi-calendar

- Sidebar calendar toggles persist in `localStorage['calendar.visibleCalendars']`.
- Merged event fetch runs `events.list` per selected calendar in parallel (`Promise.all`), tags each event with `calendarId` + calendar color.
- Editor has calendar picker (writable only: `accessRole in ['owner','writer']`).

### Google Meet integration

- Editor toggle "Add Google Meet video conferencing".
- On create/update with toggle on: include `conferenceData.createRequest` + `conferenceDataVersion=1` query param.
- Display Meet link in popover.

## Error handling

| Scenario | Behavior |
|----------|----------|
| Token expired, refresh succeeds | Transparent retry |
| Refresh token revoked (401) | Set `google_calendar_connected=false`, show reconnect banner, preserve user state |
| API 403 `insufficientPermissions` | Reconnect banner (missing scope) |
| API 429 rate limit | Exponential backoff retry (3 tries), then toast |
| Optimistic mutation fails | Rollback cache, error toast, no undo toast |
| Network offline | Queue not implemented in v1 — show error toast |

## Testing

Playwright E2E flow on deployed preview:
1. Sign in with Google
2. Connect calendar (OAuth flow)
3. Navigate to `/calendar`
4. Create event via Create button → verify appears
5. Drag event to new slot → verify Google API updated
6. Resize event → verify duration change persisted
7. Edit recurring event → "This and following" → verify series split
8. Delete event → verify removed + undo toast → click undo → verify restored
9. Toggle calendar visibility → verify events hide/show
10. Sign out, sign back in → verify calendar still works (regression guard from prior bug)

## Files changed

**New:** all under `src/app/calendar/`, `src/components/calendar/`, `src/lib/google/calendar.ts`, 5 new API route files.

**Modified:** `src/app/api/calendar/events/route.ts` (GET refactor + add POST).

**Deleted:** `src/components/LiveCalendarView.tsx`, `src/components/EmbeddedCalendarView.tsx`, `src/app/api/calendar/embed-url/route.ts`. Also purge imports in `src/app/scan/page.tsx` and replace with redirect/link to `/calendar`.

## Non-goals (v1)

- Offline queue / IndexedDB cache
- Tasks integration
- Appointment slots / bookable hours
- World clock / time-zone overlay
- Keyboard shortcuts beyond `c` (create) — future enhancement
- Shared-calendar ACL editing

## Dependencies

- `@schedule-x/react@^2`
- `@schedule-x/calendar@^2`
- `@schedule-x/drag-and-drop@^2`
- `@schedule-x/event-modal@^2` (may use or replace with custom popover)
- `@schedule-x/theme-default`
- `rrule@^2` (RRULE parsing)
- `@tanstack/react-query@^5`
