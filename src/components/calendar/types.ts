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
  calendarColor?: string;  // joined client-side; fallback to '#3b82f6' when absent
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
  timezone?: string;   // IANA timezone (e.g., "America/Chicago")
}
