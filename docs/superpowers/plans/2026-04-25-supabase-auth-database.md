# Sub-project 1: Database + Auth (Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase (auth + Firestore) with Supabase (auth + Postgres) while keeping the app functional at every step.

**Architecture:** Supabase Auth handles Google OAuth and email/password signup. Supabase Postgres stores users, events, documents, and calendar_syncs. Server-side uses Supabase service role key for admin operations. Client-side uses Supabase anon key with RLS policies for data access. Next.js middleware refreshes auth sessions automatically.

**Tech Stack:** @supabase/supabase-js, @supabase/ssr, Next.js 15 App Router, Supabase Postgres with RLS

---

## File Structure

### New files:
- `src/lib/supabase/client.ts` — Browser-side Supabase client (singleton)
- `src/lib/supabase/server.ts` — Server-side Supabase client (per-request)
- `src/lib/supabase/middleware.ts` — Session refresh logic for Next.js middleware
- `src/lib/supabase/types.ts` — TypeScript types for database tables
- `src/middleware.ts` — Next.js middleware for auth session refresh
- `supabase/migrations/001_initial_schema.sql` — Database schema migration
- `src/app/auth/callback/route.ts` — Supabase auth callback handler
- `src/app/auth/confirm/route.ts` — Email confirmation handler
- `src/components/AuthForm.tsx` — Email/password + Google sign-in form
- `src/components/AuthProvider.tsx` — Supabase-based auth context provider

### Modified files:
- `src/lib/UserContext.tsx` — Rewrite to use Supabase Auth
- `src/app/client-layout.tsx` — Swap UserProvider for Supabase AuthProvider
- `src/app/layout.tsx` — No changes needed (server layout is auth-agnostic)
- `src/app/api/auth/session/route.ts` — Rewrite with Supabase verification
- `src/app/api/calendar/route.ts` — Replace Firebase admin with Supabase
- `src/app/api/calendar/embed-url/route.ts` — Replace Firebase admin with Supabase
- `src/app/api/history/route.ts` — Replace Firestore with Supabase Postgres
- `src/app/api/history/[id]/route.ts` — Replace Firestore with Supabase Postgres
- `src/app/api/settings/usage/route.ts` — Replace Firestore with Supabase Postgres
- `src/lib/processingHistory.ts` — Replace Firestore with Supabase Postgres
- `src/lib/apiKeyManager.ts` — Replace Firestore with Supabase Postgres
- `src/components/GoogleAuthWrapper.tsx` — Use Supabase auth state
- `src/components/GoogleUserProfile.tsx` — Use Supabase user data
- `src/components/CalendarAuthBanner.tsx` — Use Supabase auth for reconnect
- `src/components/Header.tsx` — Use Supabase auth state
- `src/components/FileUploader.tsx` — Use Supabase auth state
- `src/components/EventList.tsx` — Use Supabase auth state
- `src/components/LiveCalendarView.tsx` — Use Supabase auth state
- `src/components/EmbeddedCalendarView.tsx` — Use Supabase auth state
- `src/components/ProcessingHistory.tsx` — Use Supabase auth state
- `src/app/dashboard/page.tsx` — Use Supabase auth state
- `package.json` — Add Supabase deps, remove Firebase deps
- `.env.local` — Replace Firebase env vars with Supabase

### Delete files:
- `src/lib/firebase.ts`
- `src/lib/firebase-admin.ts`
- `src/lib/auth.ts` (NextAuth config, no longer needed)
- `src/components/FirebaseAuthTest.tsx`
- `src/components/FirebaseTest.tsx`

---

## Task 1: Set Up Supabase Project and Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Modify: `.env.local`
- Modify: `package.json`

- [ ] **Step 1: Install Supabase packages**

```bash
cd /Users/martinofunrein/Downloads/syllascan
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Create Supabase project (manual step)**

Go to https://supabase.com/dashboard and create a new project called "syllascan". Note the project URL and anon key from Settings > API. Also get the service role key.

Configure Google OAuth provider in Authentication > Providers > Google:
- Client ID: same Google OAuth client ID currently in .env.local
- Client Secret: same Google OAuth client secret currently in .env.local
- Redirect URL: copy from Supabase dashboard into Google Cloud Console authorized redirect URIs

Enable email/password auth in Authentication > Providers > Email (enabled by default).

- [ ] **Step 3: Write the database migration SQL**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom enum types
CREATE TYPE event_type AS ENUM (
  'exam', 'assignment', 'discussion', 'reading',
  'class', 'meeting', 'personal', 'other'
);

CREATE TYPE event_category AS ENUM (
  'academic', 'personal', 'work', 'other'
);

CREATE TYPE event_source AS ENUM (
  'extraction', 'manual', 'google_calendar'
);

CREATE TYPE extraction_status AS ENUM (
  'pending', 'processing', 'completed', 'failed'
);

CREATE TYPE sync_direction AS ENUM (
  'to_google', 'from_google'
);

CREATE TYPE sync_status AS ENUM (
  'success', 'failed'
);

-- Users profile table (extends Supabase Auth users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  google_calendar_connected BOOLEAN DEFAULT FALSE,
  google_tokens JSONB,
  preferences JSONB DEFAULT '{"theme": "dark", "default_view": "month", "auto_sync_google": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date DATE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,
  type event_type DEFAULT 'other',
  category event_category DEFAULT 'other',
  source event_source DEFAULT 'manual',
  source_document_id UUID,
  google_event_id TEXT,
  is_all_day BOOLEAN DEFAULT FALSE,
  recurrence JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents table
CREATE TABLE public.documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  page_count INTEGER DEFAULT 1,
  storage_path TEXT,
  extraction_status extraction_status DEFAULT 'pending',
  events_extracted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from events to documents (after documents table exists)
ALTER TABLE public.events
  ADD CONSTRAINT fk_events_document
  FOREIGN KEY (source_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;

-- Calendar sync log
CREATE TABLE public.calendar_syncs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  google_event_id TEXT,
  sync_direction sync_direction NOT NULL,
  status sync_status NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- API usage tracking (replaces Firestore apiUsage collection)
CREATE TABLE public.api_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  extraction_count INTEGER DEFAULT 0,
  chat_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_events_user_id ON public.events(user_id);
CREATE INDEX idx_events_date ON public.events(date);
CREATE INDEX idx_events_user_date ON public.events(user_id, date);
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_calendar_syncs_user_id ON public.calendar_syncs(user_id);
CREATE INDEX idx_calendar_syncs_event_id ON public.calendar_syncs(event_id);
CREATE INDEX idx_api_usage_user_date ON public.api_usage(user_id, date);

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own data
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own events"
  ON public.events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events"
  ON public.events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events"
  ON public.events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own events"
  ON public.events FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own syncs"
  ON public.calendar_syncs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own syncs"
  ON public.calendar_syncs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own usage"
  ON public.api_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage"
  ON public.api_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own usage"
  ON public.api_usage FOR UPDATE USING (auth.uid() = user_id);

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: create profile when new auth user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

- [ ] **Step 4: Run the migration in Supabase**

Go to Supabase Dashboard > SQL Editor. Paste and run the contents of `supabase/migrations/001_initial_schema.sql`.

Verify: go to Table Editor and confirm all 5 tables exist (users, events, documents, calendar_syncs, api_usage) with correct columns.

- [ ] **Step 5: Update environment variables**

Add to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Keep all existing Firebase/Google vars for now — we'll remove them after migration is complete.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql package.json package-lock.json
git commit -m "feat: add Supabase deps and database schema migration"
```

---

## Task 2: Create Supabase Client Utilities

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/lib/supabase/types.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Create database types**

Create `src/lib/supabase/types.ts`:

```typescript
export type EventType =
  | 'exam'
  | 'assignment'
  | 'discussion'
  | 'reading'
  | 'class'
  | 'meeting'
  | 'personal'
  | 'other';

export type EventCategory = 'academic' | 'personal' | 'work' | 'other';
export type EventSource = 'extraction' | 'manual' | 'google_calendar';
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type SyncDirection = 'to_google' | 'from_google';
export type SyncStatus = 'success' | 'failed';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  google_calendar_connected: boolean;
  google_tokens: { access_token: string; refresh_token: string } | null;
  preferences: {
    theme: 'dark' | 'light';
    default_view: 'month' | 'week' | 'day' | 'agenda';
    auto_sync_google: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  type: EventType;
  category: EventCategory;
  source: EventSource;
  source_document_id: string | null;
  google_event_id: string | null;
  is_all_day: boolean;
  recurrence: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  page_count: number;
  storage_path: string | null;
  extraction_status: ExtractionStatus;
  events_extracted: number;
  created_at: string;
}

export interface CalendarSync {
  id: string;
  user_id: string;
  event_id: string;
  google_event_id: string | null;
  sync_direction: SyncDirection;
  status: SyncStatus;
  synced_at: string;
}

export interface ApiUsage {
  id: string;
  user_id: string;
  date: string;
  extraction_count: number;
  chat_count: number;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserProfile;
        Insert: Partial<UserProfile> & { id: string; email: string };
        Update: Partial<UserProfile>;
      };
      events: {
        Row: CalendarEvent;
        Insert: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<CalendarEvent>;
      };
      documents: {
        Row: Document;
        Insert: Omit<Document, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Document>;
      };
      calendar_syncs: {
        Row: CalendarSync;
        Insert: Omit<CalendarSync, 'id' | 'synced_at'> & { id?: string };
        Update: Partial<CalendarSync>;
      };
      api_usage: {
        Row: ApiUsage;
        Insert: Omit<ApiUsage, 'id' | 'created_at'> & { id?: string };
        Update: Partial<ApiUsage>;
      };
    };
  };
}
```

- [ ] **Step 2: Create browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Create server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore in Server Components (read-only cookies)
          }
        },
      },
    }
  );
}

export async function createServiceRoleClient() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

- [ ] **Step 4: Create middleware helper**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
```

- [ ] **Step 5: Create Next.js middleware**

Create `src/middleware.ts`:

```typescript
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts
git commit -m "feat: add Supabase client utilities and auth middleware"
```

---

## Task 3: Create Supabase Auth Provider and Auth Form

**Files:**
- Create: `src/components/AuthProvider.tsx`
- Create: `src/components/AuthForm.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/auth/confirm/route.ts`

- [ ] **Step 1: Create the auth callback route**

This handles the OAuth redirect from Supabase after Google sign-in or email confirmation.

Create `src/app/auth/callback/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
```

- [ ] **Step 2: Create the email confirmation route**

Create `src/app/auth/confirm/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as 'signup' | 'recovery' | null;

  if (token_hash && type) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=confirmation_failed`);
}
```

- [ ] **Step 3: Create the AuthProvider component**

This replaces the existing UserProvider from UserContext.tsx.

Create `src/components/AuthProvider.tsx`:

```typescript
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/supabase/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  authenticated: boolean;
  googleCalendarConnected: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        authenticated: !!user,
        googleCalendarConnected: profile?.google_calendar_connected ?? false,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 4: Create the AuthForm component**

Create `src/components/AuthForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useAuth } from './AuthProvider';

export default function AuthForm() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const result = await signUpWithEmail(email, password, name);
        if (result.error) {
          setError(result.error);
        } else {
          setCheckEmail(true);
        }
      } else {
        const result = await signInWithEmail(email, password);
        if (result.error) setError(result.error);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (checkEmail) {
    return (
      <div className="liquid-glass rounded-2xl p-8 max-w-md mx-auto text-center">
        <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
        <p className="text-white/60">
          We sent a confirmation link to <strong className="text-white">{email}</strong>.
          Click it to activate your account.
        </p>
      </div>
    );
  }

  return (
    <div className="liquid-glass rounded-2xl p-8 max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-white mb-6 text-center">
        {mode === 'signin' ? 'Sign In' : 'Create Account'}
      </h2>

      <button
        onClick={signInWithGoogle}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl
                   bg-white/10 hover:bg-white/20 text-white transition-colors mb-6"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-white/20" />
        <span className="text-white/40 text-sm">or</span>
        <div className="flex-1 h-px bg-white/20" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                       text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                     text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                     text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
        />

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                     text-white font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-white/40 text-sm mt-4">
        {mode === 'signin' ? (
          <>
            Don&apos;t have an account?{' '}
            <button onClick={() => { setMode('signup'); setError(null); }} className="text-blue-400 hover:text-blue-300">
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button onClick={() => { setMode('signin'); setError(null); }} className="text-blue-400 hover:text-blue-300">
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/AuthProvider.tsx src/components/AuthForm.tsx src/app/auth/
git commit -m "feat: add Supabase auth provider, auth form, and callback routes"
```

---

## Task 4: Wire Up AuthProvider and Replace UserContext References

**Files:**
- Modify: `src/app/client-layout.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/GoogleAuthWrapper.tsx`
- Modify: `src/components/GoogleUserProfile.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/FileUploader.tsx`
- Modify: `src/components/EventList.tsx`
- Modify: `src/components/LiveCalendarView.tsx`
- Modify: `src/components/EmbeddedCalendarView.tsx`
- Modify: `src/components/ProcessingHistory.tsx`

- [ ] **Step 1: Update client-layout.tsx**

Replace the `UserProvider` import and usage with `AuthProvider`.

In `src/app/client-layout.tsx`, find:
```typescript
import { UserProvider } from '@/lib/UserContext';
```
Replace with:
```typescript
import { AuthProvider } from '@/components/AuthProvider';
```

Find the JSX wrapping `<UserProvider>...</UserProvider>` and replace with `<AuthProvider>...</AuthProvider>`.

- [ ] **Step 2: Update Header.tsx**

In `src/components/Header.tsx`, find:
```typescript
import { useUser } from '@/lib/UserContext';
```
Replace with:
```typescript
import { useAuth } from '@/components/AuthProvider';
```

Replace all `useUser()` calls with `useAuth()`. Map the old properties:
- `user` → `user`
- `authenticated` → `authenticated`
- `signIn()` → `signInWithGoogle()`
- `signOut()` → `signOut()`
- `user?.displayName` → `profile?.display_name`
- `user?.email` → `user?.email`
- `user?.photoURL` → `profile?.avatar_url`

- [ ] **Step 3: Update GoogleAuthWrapper.tsx**

In `src/components/GoogleAuthWrapper.tsx`, replace:
```typescript
import { useUser } from '@/lib/UserContext';
```
with:
```typescript
import { useAuth } from '@/components/AuthProvider';
```

Replace `useUser()` with `useAuth()`. Map:
- `authenticated` → `authenticated`
- `googleAuthenticated` → `googleCalendarConnected`
- `signIn()` → `signInWithGoogle()`
- `loading` → `loading`

- [ ] **Step 4: Update GoogleUserProfile.tsx**

Replace the fetch-based profile loading with direct Supabase profile data.

In `src/components/GoogleUserProfile.tsx`, replace the entire component to use `useAuth()`:
```typescript
'use client';

import { useAuth } from '@/components/AuthProvider';

export default function GoogleUserProfile() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center gap-3 animate-pulse">
        <div className="w-8 h-8 rounded-full bg-white/10" />
        <div className="h-4 w-24 rounded bg-white/10" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex items-center gap-3">
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.display_name || ''}
          className="w-8 h-8 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
          {(profile.display_name || profile.email)?.[0]?.toUpperCase()}
        </div>
      )}
      <span className="text-white/80 text-sm">{profile.display_name || profile.email}</span>
    </div>
  );
}
```

- [ ] **Step 5: Update remaining components**

For each of these files, apply the same pattern — replace `useUser` import with `useAuth` import:

**`src/app/dashboard/page.tsx`:**
- `import { useUser } from '@/lib/UserContext'` → `import { useAuth } from '@/components/AuthProvider'`
- `const { user, authenticated } = useUser()` → `const { user, profile, authenticated } = useAuth()`
- `user?.displayName` → `profile?.display_name`
- `user?.email` → `user?.email`

**`src/components/FileUploader.tsx`:**
- Same import swap
- `const { authenticated, googleAuthenticated } = useUser()` → `const { authenticated, googleCalendarConnected } = useAuth()`

**`src/components/EventList.tsx`:**
- Same import swap
- `const { authenticated, googleAuthenticated } = useUser()` → `const { authenticated, googleCalendarConnected } = useAuth()`

**`src/components/LiveCalendarView.tsx`:**
- Same import swap
- `const { authenticated, googleAuthenticated } = useUser()` → `const { authenticated, googleCalendarConnected } = useAuth()`

**`src/components/EmbeddedCalendarView.tsx`:**
- Same import swap

**`src/components/ProcessingHistory.tsx`:**
- Same import swap

- [ ] **Step 6: Verify the app compiles**

```bash
cd /Users/martinofunrein/Downloads/syllascan && npm run build
```

Expected: Build succeeds (may have warnings). If there are TypeScript errors from property mismatches, fix them — the old Firebase `User` type has different properties than Supabase's `User`.

- [ ] **Step 7: Commit**

```bash
git add src/app/client-layout.tsx src/components/ src/app/dashboard/
git commit -m "feat: wire AuthProvider into all components, replace useUser with useAuth"
```

---

## Task 5: Migrate Server-Side API Routes to Supabase

**Files:**
- Modify: `src/app/api/auth/session/route.ts`
- Modify: `src/app/api/calendar/route.ts`
- Modify: `src/app/api/calendar/embed-url/route.ts`
- Modify: `src/app/api/history/route.ts`
- Modify: `src/app/api/history/[id]/route.ts`
- Modify: `src/app/api/settings/usage/route.ts`
- Modify: `src/lib/processingHistory.ts`
- Modify: `src/lib/apiKeyManager.ts`

- [ ] **Step 1: Rewrite session route**

Replace `src/app/api/auth/session/route.ts` entirely:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    uid: user.id,
    email: user.email,
    authenticated: true,
  });
}
```

- [ ] **Step 2: Update calendar route**

In `src/app/api/calendar/route.ts`, replace Firebase Admin auth verification with Supabase:

Remove:
```typescript
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
```

Add:
```typescript
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
```

Replace the auth verification block (the part that verifies Firebase ID tokens) with:
```typescript
const supabase = await createServerSupabaseClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Replace Firestore history writes with Supabase inserts:
```typescript
const serviceClient = await createServiceRoleClient();
await serviceClient.from('calendar_syncs').insert({
  user_id: user.id,
  event_id: eventId,
  google_event_id: googleEventId,
  sync_direction: 'to_google',
  status: 'success',
});
```

Google Calendar token retrieval: instead of reading from cookies, read from Supabase:
```typescript
const { data: profile } = await supabase
  .from('users')
  .select('google_tokens')
  .eq('id', user.id)
  .single();

const accessToken = profile?.google_tokens?.access_token;
const refreshToken = profile?.google_tokens?.refresh_token;
```

- [ ] **Step 2b: Update calendar embed-url route**

In `src/app/api/calendar/embed-url/route.ts`, apply the same pattern as the calendar route:

Remove Firebase Admin imports. Add:
```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';
```

Replace the auth verification with:
```typescript
const supabase = await createServerSupabaseClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

- [ ] **Step 3: Update history routes**

Replace `src/app/api/history/route.ts` — swap Firestore queries for Supabase:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: documents });
}
```

Replace `src/app/api/history/[id]/route.ts`:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Update usage route**

Replace `src/app/api/settings/usage/route.ts`:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  const { data: usage } = await supabase
    .from('api_usage')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single();

  return NextResponse.json({
    extraction_count: usage?.extraction_count ?? 0,
    chat_count: usage?.chat_count ?? 0,
  });
}
```

- [ ] **Step 5: Update processingHistory.ts**

Replace `src/lib/processingHistory.ts`:

```typescript
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function recordProcessingHistory(
  userId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  pageCount: number,
  eventsExtracted: number,
  status: 'completed' | 'failed'
) {
  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      page_count: pageCount,
      events_extracted: eventsExtracted,
      extraction_status: status,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

- [ ] **Step 6: Update apiKeyManager.ts**

Replace `src/lib/apiKeyManager.ts`:

```typescript
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function incrementUsage(userId: string, field: 'extraction_count' | 'chat_count') {
  const supabase = await createServiceRoleClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('api_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (existing) {
    await supabase
      .from('api_usage')
      .update({ [field]: (existing[field] || 0) + 1 })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('api_usage')
      .insert({
        user_id: userId,
        date: today,
        [field]: 1,
      });
  }
}

export async function getUsage(userId: string) {
  const supabase = await createServiceRoleClient();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('api_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  return {
    extraction_count: data?.extraction_count ?? 0,
    chat_count: data?.chat_count ?? 0,
  };
}
```

- [ ] **Step 7: Verify build**

```bash
cd /Users/martinofunrein/Downloads/syllascan && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/ src/lib/processingHistory.ts src/lib/apiKeyManager.ts
git commit -m "feat: migrate all API routes from Firebase Admin to Supabase"
```

---

## Task 6: Add Google Calendar OAuth Flow (Separate from Login)

**Files:**
- Create: `src/app/api/google-calendar/authorize/route.ts`
- Create: `src/app/api/google-calendar/callback/route.ts`
- Modify: `src/components/CalendarAuthBanner.tsx`

- [ ] **Step 1: Create the Google Calendar authorization route**

This initiates a separate OAuth flow specifically for Google Calendar access (independent of Supabase login).

Create `src/app/api/google-calendar/authorize/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google-calendar/callback`;
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  return NextResponse.json({ url: authUrl.toString() });
}
```

- [ ] **Step 2: Create the callback route**

Create `src/app/api/google-calendar/callback/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/dashboard?calendar_error=denied`);
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/?error=not_authenticated`);
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || origin}/api/google-calendar/callback`,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenResponse.json();

  if (!tokenResponse.ok) {
    return NextResponse.redirect(`${origin}/dashboard?calendar_error=token_exchange_failed`);
  }

  const serviceClient = await createServiceRoleClient();
  await serviceClient
    .from('users')
    .update({
      google_calendar_connected: true,
      google_tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      },
    })
    .eq('id', user.id);

  return NextResponse.redirect(`${origin}/dashboard?calendar_connected=true`);
}
```

- [ ] **Step 3: Update CalendarAuthBanner.tsx**

Replace the Firebase-based reconnect with the new Google Calendar OAuth flow:

```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function CalendarAuthBanner() {
  const { googleCalendarConnected } = useAuth();
  const [loading, setLoading] = useState(false);

  if (googleCalendarConnected) return null;

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/google-calendar/authorize');
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50
                    liquid-glass rounded-xl p-4 flex items-center gap-3 border border-yellow-500/30">
      <ExclamationTriangleIcon className="w-6 h-6 text-yellow-400 shrink-0" />
      <div className="flex-1">
        <p className="text-white text-sm font-medium">Google Calendar not connected</p>
        <p className="text-white/50 text-xs">Connect to sync your events</p>
      </div>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm
                   font-medium transition-colors disabled:opacity-50 shrink-0"
      >
        {loading ? 'Connecting...' : 'Connect'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local**

These should already exist from the Firebase setup. Keep them. Also add:

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For Vercel production, set `NEXT_PUBLIC_APP_URL` to `https://your-domain.vercel.app`.

- [ ] **Step 5: Update Google Cloud Console redirect URIs**

Add `http://localhost:3000/api/google-calendar/callback` and `https://your-domain.vercel.app/api/google-calendar/callback` to the authorized redirect URIs in Google Cloud Console.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/google-calendar/ src/components/CalendarAuthBanner.tsx
git commit -m "feat: add standalone Google Calendar OAuth flow, decoupled from login"
```

---

## Task 7: Remove Firebase and Clean Up

**Files:**
- Delete: `src/lib/firebase.ts`
- Delete: `src/lib/firebase-admin.ts`
- Delete: `src/lib/auth.ts`
- Delete: `src/lib/UserContext.tsx`
- Delete: `src/components/FirebaseAuthTest.tsx`
- Delete: `src/components/FirebaseTest.tsx`
- Delete: `src/app/api/auth/google/route.ts` (old Firebase OAuth initiation)
- Delete: `src/app/api/auth/callback/route.ts` (old Firebase OAuth callback)
- Delete: `src/app/api/test-firebase/route.ts` (test endpoint)
- Modify: `package.json`
- Modify: `.env.local`

- [ ] **Step 1: Remove Firebase packages**

```bash
cd /Users/martinofunrein/Downloads/syllascan
npm uninstall firebase firebase-admin next-auth
```

- [ ] **Step 2: Delete Firebase files**

```bash
rm src/lib/firebase.ts
rm src/lib/firebase-admin.ts
rm src/lib/auth.ts
rm src/lib/UserContext.tsx
rm src/components/FirebaseAuthTest.tsx
rm src/components/FirebaseTest.tsx
rm src/app/api/auth/google/route.ts
rm src/app/api/auth/callback/route.ts
rm src/app/api/test-firebase/route.ts
```

- [ ] **Step 3: Remove old Firebase auth API directory if empty**

```bash
# Keep src/app/api/auth/session/route.ts (rewritten to use Supabase)
# Remove any other leftover files in api/auth/
ls src/app/api/auth/
```

Keep only `session/route.ts`. Delete anything else that references Firebase.

- [ ] **Step 4: Clean .env.local**

Remove these variables (they're now in Supabase dashboard config or no longer needed):
```
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXTAUTH_SECRET
NEXTAUTH_URL
```

Keep:
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OPENAI_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

- [ ] **Step 5: Search for any remaining Firebase references**

```bash
grep -rn "firebase" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
grep -rn "UserContext" src/ --include="*.ts" --include="*.tsx"
grep -rn "useUser" src/ --include="*.ts" --include="*.tsx"
grep -rn "UserProvider" src/ --include="*.ts" --include="*.tsx"
```

Fix any remaining references found.

- [ ] **Step 6: Verify build**

```bash
cd /Users/martinofunrein/Downloads/syllascan && npm run build
```

Expected: Clean build with no Firebase-related errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: remove Firebase entirely, Supabase is now sole auth and database provider"
```

---

## Task 8: Manual Smoke Test

- [ ] **Step 1: Start dev server**

```bash
cd /Users/martinofunrein/Downloads/syllascan && npm run dev
```

- [ ] **Step 2: Test email/password signup**

1. Go to http://localhost:3000
2. Click sign up
3. Enter email, password, name
4. Check email for confirmation link
5. Click confirmation link
6. Verify redirect to /dashboard
7. Verify user profile shows in header

- [ ] **Step 3: Test Google sign-in**

1. Sign out
2. Click "Continue with Google"
3. Complete Google OAuth flow
4. Verify redirect to /dashboard
5. Verify profile (name, avatar) loads from Google

- [ ] **Step 4: Test Google Calendar connection**

1. While signed in, check that CalendarAuthBanner shows "Connect" button
2. Click "Connect"
3. Complete Google Calendar OAuth consent
4. Verify redirect back with `calendar_connected=true`
5. Verify CalendarAuthBanner disappears
6. Verify google_calendar_connected is true in Supabase users table

- [ ] **Step 5: Test existing features still work**

1. Upload a document (image) and verify extraction works
2. Verify events display in the event list
3. Verify calendar view loads
4. Verify processing history shows in dashboard

- [ ] **Step 6: Commit any fixes from smoke testing**

```bash
git add -A
git commit -m "fix: smoke test fixes for Supabase auth migration"
```

---

## Task 9: Deploy to Vercel

- [ ] **Step 1: Add environment variables to Vercel**

In Vercel project settings, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (set to production URL)
- Keep `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`

Remove old Firebase env vars from Vercel.

- [ ] **Step 2: Update Google Cloud Console**

Add production callback URLs:
- `https://YOUR_SUPABASE_REF.supabase.co/auth/v1/callback` (for Supabase Google OAuth)
- `https://your-domain.vercel.app/api/google-calendar/callback` (for Calendar OAuth)

- [ ] **Step 3: Update Supabase dashboard**

In Authentication > URL Configuration:
- Site URL: `https://your-domain.vercel.app`
- Redirect URLs: add `https://your-domain.vercel.app/auth/callback`

- [ ] **Step 4: Deploy**

```bash
cd /Users/martinofunrein/Downloads/syllascan && vercel --prod
```

- [ ] **Step 5: Verify production deployment**

Run through the same smoke tests from Task 8 on the production URL.

- [ ] **Step 6: Commit any production fixes**

```bash
git add -A
git commit -m "fix: production deployment adjustments for Supabase migration"
```
