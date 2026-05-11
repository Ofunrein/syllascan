# Google Calendar Auth Fix

## Symptoms
- Live Calendar shows "Google Calendar needs updated permission. Reconnect once to grant calendar access." on every load
- Error persists after clicking "Try Again"
- Reconnecting fixes it temporarily, but breaks again after sign-out/sign-in

## Root Causes (3 bugs)

### Bug 1 — `redirect_uri_mismatch` on reconnect
**File:** `src/app/api/google-calendar/authorize/route.ts`

The authorize route derived `redirect_uri` from `new URL(request.url).origin`. Every new Vercel deployment gets a unique preview URL (e.g. `syllascan-martin-abc123.vercel.app`), which was never registered in Google Cloud Console.

**Fix:** Route now reads `process.env.GOOGLE_REDIRECT_URI` first, falling back to request origin. Vercel env var set to the stable alias `https://syllascan-martin.vercel.app/api/google-calendar/callback`.

---

### Bug 2 — Tokens never saved to Supabase (1hr expiry loop)
**File:** `src/pages/oauth2callback.tsx` → `src/pages/api/auth/token.ts`

The OAuth callback used to redirect to `/oauth2callback` (Pages Router), which called `/api/auth/token`. That route tried to persist tokens to Supabase by regex-parsing the Supabase session cookie header (`sb-[^=]+-auth-token=...`). This silently failed on Supabase's current cookie format. Tokens only landed in browser cookies (1hr access token), never in Supabase. After 1hr, cookies expired → 403 → reconnect loop.

**Fix:** `GOOGLE_REDIRECT_URI` now points to `/api/google-calendar/callback` (App Router), which uses `supabase.auth.getUser()` reliably and persists `access_token + refresh_token + expires_at` to the `users` table via service role client.

---

### Bug 3 — Calendar tokens wiped on every sign-in ← **primary cause of persistent loop**
**File:** `src/app/auth/callback/route.ts`

Every time the user signed in with Google (Supabase OAuth), the auth callback upserted the `users` row using `data.session.provider_token` as the `google_tokens.access_token`. This token is issued by Supabase's own Google OAuth consent, which only requests `email` and `profile` scopes — **not** `calendar.events`. It silently overwrote the calendar-scoped tokens saved by Bug 2's fix.

Next calendar fetch → Google returns 403 `insufficientPermissions` → app shows reconnect error.

**Fix:** Auth callback now checks if `existingProfile.google_tokens.refresh_token` exists (indicates tokens came from the dedicated calendar OAuth flow). If yes, preserves existing tokens and sets `google_calendar_connected: true`. Does not touch calendar tokens on sign-in.

---

### Bug 4 — RLS blocking token reads (silent null fallback)
**File:** `src/app/api/calendar/events/route.ts`

The events route used `createServerSupabaseClient()` (anon key, subject to RLS) to read `google_tokens`. If RLS blocked the read, the query returned `null` silently with no error. The code then fell back to old stale browser cookies → 403 loop.

**Fix:** Events route now uses `createServiceRoleClient()` to read tokens, bypassing RLS entirely.

---

## Token Flow (after fixes)

```
User signs in (Supabase Google OAuth)
  └─ /auth/callback: upserts user profile, preserves existing calendar tokens

User clicks "Connect Google Calendar"
  └─ /api/google-calendar/authorize: returns OAuth URL with redirect_uri = GOOGLE_REDIRECT_URI env var
  └─ Google OAuth consent (calendar.events + calendar.readonly scopes)
  └─ /api/google-calendar/callback: saves access_token + refresh_token + expires_at to users table
  └─ google_calendar_connected = true

User visits Live Calendar
  └─ /api/calendar/events: reads google_tokens via service role client
  └─ if expires_at within 5min: proactively refreshes via refresh_token, updates Supabase
  └─ Calendar events fetched and rendered

User signs out and back in
  └─ /auth/callback: sees existing refresh_token → preserves tokens, keeps google_calendar_connected = true
  └─ Calendar works immediately, no reconnect needed
```

## Google Cloud Console

- **Client in use:** SyllaScan (`61015307582-2jcvc...`)
- **Registered redirect URIs:**
  - `https://ttrmkskdqtfgbyzifjyc.supabase.co/auth/v1/callback` (Supabase sign-in)
  - `https://syllascan-martin.vercel.app/api/google-calendar/callback` (calendar OAuth)
  - `https://syllascan-martin.vercel.app/oauth2callback` (legacy, kept for safety)
- **App verification status:** Unverified — shows warning for non-test users. Developer can bypass via Advanced → proceed.
