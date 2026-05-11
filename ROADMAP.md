# SyllaScan Roadmap

## Planned Features

### Edit Google Calendar Events (post-sync)
After events have been extracted and synced to Google Calendar, they no longer appear in the Events tab but are visible in the Live Calendar / Embedded Calendar views. Need to add the ability to edit these synced events directly from the Live Calendar or Embedded Calendar view.

**Scope:**
- Click an event in Live Calendar view → open edit modal (prefilled with current event data)
- Edit title, date/time, description, location
- PUT to `/api/calendar/event/[googleEventId]` → update via Google Calendar API
- Optimistic UI update in the calendar view

**API needed:** `PATCH /api/calendar/event` with `{ googleEventId, calendarId, updates }`

---

## Completed Bug Fixes
- Events persisting after clear (DB not deleted on GCal sync clear path)
- storedEvents useEffect not clearing local state when store empties
- EventList selectedEvents reset on every events prop update
- Background video scaling on mobile
- Google OAuth redirect_uri_mismatch on reconnect
- Google Calendar auth token proactive refresh with expires_at
