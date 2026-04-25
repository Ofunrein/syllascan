# SyllaScan Overhaul Design Spec

## Overview

SyllaScan is a Next.js 15 web app that extracts calendar events from syllabus documents using AI vision and syncs them to Google Calendar. This spec covers a full-stack overhaul: migrating to Supabase (auth + database), expanding document support, adding NLP event creation, improving the calendar experience, and polishing the UI.

The approach is **incremental migration** — each sub-project is independently deployable. The app keeps working at every step.

## Architecture

- **Framework:** Next.js 15 (App Router, React 19, TypeScript)
- **Database + Auth:** Supabase (Postgres + Supabase Auth + Storage)
- **AI Model:** OpenAI gpt-5.4-mini for all tasks (vision extraction, NLP parsing, chat assistant)
- **Calendar:** Google Calendar API v3 (separate OAuth consent, not tied to login)
- **Styling:** Tailwind CSS 4 with liquid glass theme (dark + light modes)
- **State:** Zustand for client-side UI state; Supabase as source of truth for persistent data
- **Deployment:** Vercel

Firebase is removed entirely. Supabase Auth handles Google OAuth and email/password. Firestore is replaced by Supabase Postgres.

## Sub-project Order

1. Database + Auth (Supabase)
2. Document extraction engine
3. Event management + NLP
4. Calendar + sync improvements
5. UI polish + navigation restructure

Each sub-project gets its own implementation plan and deploy cycle.

---

## Sub-project 1: Database Schema & Supabase Auth

### Auth

Supabase Auth replaces Firebase. Two sign-in methods:

- **Google OAuth** — configured as a Supabase Auth provider. Users who sign in with Google can optionally connect Google Calendar via a separate OAuth consent flow.
- **Email/password** — standard signup. Can connect Google Calendar later from settings.

Google Calendar API tokens (access + refresh) are obtained via a dedicated OAuth consent flow, stored encrypted in the user's Supabase record. This decouples login from calendar access.

### Database Schema

**users**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | From Supabase Auth |
| email | text | |
| display_name | text | |
| avatar_url | text | |
| google_calendar_connected | boolean | |
| google_tokens | jsonb | Access/refresh tokens, encrypted at application level before storage |
| preferences | jsonb | Theme, default view, auto_sync_google, etc. |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**events**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| user_id | uuid | FK to users |
| title | text | Required |
| description | text | |
| date | date | |
| start_time | timestamptz | |
| end_time | timestamptz | |
| location | text | |
| type | enum | exam, assignment, discussion, reading, class, meeting, personal, other |
| category | enum | academic, personal, work, other |
| source | enum | extraction, manual, google_calendar |
| source_document_id | uuid | FK to documents, nullable |
| google_event_id | text | Nullable, for sync tracking |
| is_all_day | boolean | |
| recurrence | jsonb | Nullable, for recurring events |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**documents**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| user_id | uuid | FK to users |
| file_name | text | |
| file_type | text | pdf, docx, pptx, xlsx, csv, txt, rtf, html, image |
| file_size | integer | |
| page_count | integer | |
| storage_path | text | Supabase Storage reference |
| extraction_status | enum | pending, processing, completed, failed |
| events_extracted | integer | |
| created_at | timestamptz | |

**calendar_syncs**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| user_id | uuid | FK to users |
| event_id | uuid | FK to events |
| google_event_id | text | |
| sync_direction | enum | to_google, from_google |
| status | enum | success, failed |
| synced_at | timestamptz | |

### Urgency Scoring

Computed on read, not stored. Formula: `type_weight * (1 / max(days_remaining, 0.1))`

Type weights: exam=5, assignment=4, quiz=3, discussion=2, class=1, meeting=2, personal=1, other=1.

Events within 48 hours get a 2x boost. This powers the deadline countdown dashboard widget.

### Row-Level Security

All tables have RLS policies enforcing `user_id = auth.uid()`. Users can only read/write their own data.

---

## Sub-project 2: Document Extraction Engine

### Supported Formats

PDF (all pages), images (jpg/png/gif/webp), Word (.docx), PowerPoint (.pptx), Excel (.xlsx), CSV, plain text (.txt), RTF, HTML.

### Processing Pipeline

```
Upload → File type detection → Conversion layer → AI extraction → Event normalization → Dedup → Save to DB
```

### Conversion Strategies

| Format | Strategy | AI Input |
|--------|----------|----------|
| PDF | pdfjs-dist renders ALL pages to images | Vision (multi-image) |
| Images | Direct base64 | Vision |
| Word (.docx) | mammoth library → text + embedded images | Text (+ vision for images) |
| PowerPoint (.pptx) | pptxgenjs or officegen → text from all slides | Text |
| Excel (.xlsx) / CSV | xlsx library → structured text | Text |
| Plain text / RTF / HTML | Direct text extraction, strip formatting | Text |

Text-heavy documents use text input (faster, cheaper, more accurate). Only PDFs and images use vision. The API auto-detects which path to take based on file type.

### Multi-page Handling

PDFs render each page to an image. All pages sent in a single gpt-5.4-mini call as multiple image inputs. For documents over 10 pages, batch into chunks of 5 pages per API call and merge results. Deduplication across chunks prevents duplicate events from content that spans pages.

### Extraction Prompt

The extraction prompt includes:
- Academic year context (infer semester from document clues)
- Recurring event detection ("every Tuesday" generates a series)
- Relative date resolution ("Week 3" resolved to actual date based on semester start)
- Event type classification (exam, assignment, discussion, reading, class, meeting, personal, other)
- Category auto-assignment (academic vs personal vs work)
- Confidence scoring per event

### Deduplication

Match on title + date + description against the full database (not just the current extraction batch). Near-matches flagged for user review rather than silently dropped.

### Current Bug Fix

The existing PDF extraction only renders the first page. This is fixed as part of this sub-project — all pages are rendered and processed.

---

## Sub-project 3: Event Management + NLP

### Event Creation Methods

1. **Document extraction** — upload flow, events saved to Supabase after review
2. **Quick-add with NLP** — floating action button on every page. Natural language input parsed by gpt-5.4-mini into structured event. Examples:
   - "Midterm March 15 2pm room 301" → exam event
   - "Reading chapters 5-7 due next friday" → reading assignment
   - "Team meeting every wednesday 4pm" → recurring meeting
3. **Manual form** — traditional form fields

### NLP Parsing Flow

```
User input → gpt-5.4-mini → structured event JSON → preview card → user confirms/edits → save to DB
```

The preview card shows what the AI understood before saving. User can edit any field inline if the AI got something wrong.

### Event Editing

- Any event can be edited regardless of source (extracted, manual, Google Calendar)
- Edit via form or via NLP ("move this to next monday", "change time to 3pm")
- Edits to Google-synced events push back to Google Calendar automatically (if auto-sync enabled)

### AI Chat Assistant

The existing experimental chat tab in EventEditor is upgraded to be the primary NLP interaction. The model has context about the user's existing events, enabling queries like "schedule study session the day before my midterm."

### Smart Categories

AI auto-categorizes events during creation/extraction. Academic events get visual priority (urgency coloring, deadline countdowns). Personal/work events display in neutral style but are included in all views.

### Urgency Dashboard Widget

- Displayed on the main dashboard / home page
- Lists upcoming events sorted by urgency score
- Color-coded: red (< 48hrs), orange (< 1 week), yellow (< 2 weeks), green (> 2 weeks)
- Countdown text: "2 days", "5 hours", etc.
- Academic events get urgency treatment by default; personal events show without urgency styling

---

## Sub-project 4: Calendar & Sync

### Calendar as Top-Level Route

Calendar moves from a tab within /scan to its own route (`/calendar`). This is the primary view for day-to-day use.

### Views

Month, week, day, agenda — powered by react-big-calendar with Supabase data as source of truth.

### Merged Data Sources

One unified calendar view showing:
- Events from Supabase (extracted + manual) — with type badges and urgency coloring
- Events from Google Calendar (fetched via API) — neutral style
- Visual distinction between sources

### Sync Behavior

| Action | Behavior |
|--------|----------|
| Extract events from document | Saved to Supabase. Manual or auto sync to Google Calendar based on user preference. |
| Create event via NLP/form | Saved to Supabase. Manual or auto sync based on preference. |
| Edit a Supabase event | Updated in DB. If synced to Google and auto-sync enabled, update pushed. |
| Edit a Google Calendar event in app | Push update to Google. Save local copy to Supabase. |
| External Google Calendar change | Detected on next fetch (polling). Local copy updated. |

### Sync Modes

- **Manual sync (default):** "Sync to Google Calendar" button after creation/extraction.
- **Auto-sync (opt-in):** User enables `auto_sync_google` in settings. Every create/edit/delete automatically pushes to Google Calendar in the background.

### Offline-Capable

App works fully without Google Calendar connected. Email/password users who never connect Google get the complete experience minus calendar sync.

---

## Sub-project 5: UI Polish & Navigation

### Navigation Restructure

**Current:** Landing → /scan (4 tabs) → /dashboard

**New:**
```
Landing → /dashboard (urgency widget, recent activity, quick-add)
         /upload (streamlined upload → extract → review wizard)
         /calendar (full calendar view)
         /events (event list, search, filter by type/category)
         /settings (theme, auto-sync toggle, Google Calendar connect)
```

**Header nav:** Dashboard | Upload | Calendar | Events | (settings icon)

### Quick-Add Button

Floating action button (bottom-right corner), visible on all pages. Opens a small NLP input overlay. Type natural language, see structured preview, confirm to create.

### Light Mode

Light variant of the liquid glass theme:
- White/light gray backgrounds
- Frosted glass panels: `rgba(255,255,255,0.7)` + `backdrop-filter: blur(4px)` + light inset shadows
- Dark text on light glass surfaces
- Toggle in header or settings
- Preference saved to Supabase user profile

### Icon

Calendar-scan hybrid — calendar outline with scan lines across it. Using Lucide icons or custom SVG.

### Component Cleanup

Large components broken into focused modules during implementation:
- EventList (998 lines) → EventList + EventCard + EventFilters
- LiveCalendarView (1036 lines) → CalendarView + CalendarToolbar + EventPopover
- EventEditor (825 lines) → EventForm + AIAssistant + EventPreview

### Theme

Liquid glass design system preserved in both dark and light modes. Color tokens maintained: cal-blue, sig-green, deadline-red, muted-gray. Typography unchanged: Space Grotesk, Inter, IBM Plex Mono.

---

## Dependencies to Add

| Package | Purpose |
|---------|---------|
| @supabase/supabase-js | Supabase client |
| @supabase/ssr | Server-side Supabase for Next.js |
| mammoth | Word (.docx) to text/HTML conversion |
| xlsx | Excel/CSV parsing |

## Dependencies to Remove

| Package | Reason |
|---------|--------|
| firebase | Replaced by Supabase Auth |
| firebase-admin | Replaced by Supabase server-side |

## Environment Variables

### Remove
- All `FIREBASE_*` and `NEXT_PUBLIC_FIREBASE_*` variables
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (moved to Supabase provider config)

### Add
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

### Keep
- `OPENAI_API_KEY` (update model references from gpt-4o to gpt-5.4-mini)
