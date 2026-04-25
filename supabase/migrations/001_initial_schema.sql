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
