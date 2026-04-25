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
