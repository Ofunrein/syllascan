import { create } from 'zustand';
import { Event } from '@/lib/openai';
import { createClient } from '@/lib/supabase/client';
import type { CalendarEvent } from '@/lib/supabase/types';

// Convert DB row to component Event shape
function dbToEvent(row: CalendarEvent): Event {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    date: row.date || undefined,
    startDate: row.start_time ? new Date(row.start_time).toISOString() : undefined,
    endDate: row.end_time ? new Date(row.end_time).toISOString() : undefined,
    startTime: row.start_time ? new Date(row.start_time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : undefined,
    endTime: row.end_time ? new Date(row.end_time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : undefined,
    location: row.location || undefined,
    type: row.type,
    category: row.category,
    source: row.source,
    isAllDay: row.is_all_day,
    isRecurring: !!row.recurrence,
    google_event_id: row.google_event_id || undefined,
  };
}

// Convert component Event to DB insert shape
function eventToDb(event: Event, userId: string): Partial<CalendarEvent> {
  const date = event.date || (event.startDate ? event.startDate.split('T')[0] : undefined);
  let startTime: string | undefined;
  let endTime: string | undefined;

  if (event.startDate) {
    startTime = event.startDate;
  } else if (date && event.startTime) {
    startTime = `${date}T${event.startTime}:00`;
  }

  if (event.endDate) {
    endTime = event.endDate;
  } else if (date && event.endTime) {
    endTime = `${date}T${event.endTime}:00`;
  }

  return {
    user_id: userId,
    title: event.title,
    description: event.description || null,
    date: date || null,
    start_time: startTime || null,
    end_time: endTime || null,
    location: event.location || null,
    type: (event.type as CalendarEvent['type']) || 'other',
    category: (event.category as CalendarEvent['category']) || 'other',
    source: (event.source as CalendarEvent['source']) || 'manual',
    is_all_day: event.isAllDay || false,
    google_event_id: event.google_event_id || null,
    recurrence: event.isRecurring && event.recurrencePattern ? { pattern: event.recurrencePattern } : null,
  };
}

interface EventStore {
  events: Event[];
  loading: boolean;
  setEvents: (events: Event[]) => void;
  addEvent: (event: Event) => void;
  updateEvent: (updatedEvent: Event) => void;
  deleteEvent: (eventId: string) => void;
  clearEvents: () => void;

  // Supabase-connected operations
  fetchEvents: (userId: string) => Promise<void>;
  saveEvent: (event: Event, userId: string) => Promise<Event | null>;
  saveEvents: (events: Event[], userId: string) => Promise<void>;
  removeEvent: (eventId: string, userId: string) => Promise<void>;
  updateEventInDb: (event: Event, userId: string) => Promise<void>;
}

export const useEventStore = create<EventStore>((set) => ({
  events: [],
  loading: false,

  // Local-only operations (for immediate UI updates)
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  updateEvent: (updatedEvent) => set((state) => ({
    events: state.events.map(event => event.id === updatedEvent.id ? updatedEvent : event)
  })),
  deleteEvent: (eventId) => set((state) => ({
    events: state.events.filter(event => event.id !== eventId)
  })),
  clearEvents: () => set({ events: [] }),

  // Supabase-connected operations
  fetchEvents: async (userId: string) => {
    set({ loading: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      if (error) throw error;
      const events = (data || []).map(dbToEvent);
      set({ events, loading: false });
    } catch (error) {
      console.error('Error fetching events:', error);
      set({ loading: false });
    }
  },

  saveEvent: async (event: Event, userId: string) => {
    try {
      const supabase = createClient();
      const dbEvent = eventToDb(event, userId);
      const { data, error } = await supabase
        .from('events')
        .insert(dbEvent)
        .select()
        .single();

      if (error) throw error;
      const savedEvent = dbToEvent(data);
      set((state) => ({ events: [...state.events, savedEvent] }));
      return savedEvent;
    } catch (error) {
      console.error('Error saving event:', error);
      return null;
    }
  },

  saveEvents: async (events: Event[], userId: string) => {
    try {
      const supabase = createClient();
      const dbEvents = events.map(e => eventToDb(e, userId));
      const { data, error } = await supabase
        .from('events')
        .insert(dbEvents)
        .select();

      if (error) throw error;
      const savedEvents = (data || []).map(dbToEvent);
      set((state) => ({ events: [...state.events, ...savedEvents] }));
    } catch (error) {
      console.error('Error saving events:', error);
    }
  },

  removeEvent: async (eventId: string, userId: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', userId);

      if (error) throw error;
      set((state) => ({
        events: state.events.filter(event => event.id !== eventId)
      }));
    } catch (error) {
      console.error('Error removing event:', error);
    }
  },

  updateEventInDb: async (event: Event, userId: string) => {
    try {
      const supabase = createClient();
      const dbEvent = eventToDb(event, userId);
      const { error } = await supabase
        .from('events')
        .update(dbEvent)
        .eq('id', event.id)
        .eq('user_id', userId);

      if (error) throw error;
      set((state) => ({
        events: state.events.map(e => e.id === event.id ? event : e)
      }));
    } catch (error) {
      console.error('Error updating event:', error);
    }
  },
}));
