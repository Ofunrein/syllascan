import { create } from 'zustand';
import { Event } from '@/lib/openai';

interface EventStore {
  events: Event[];
  setEvents: (events: Event[]) => void;
  addEvent: (event: Event) => void;
  updateEvent: (updatedEvent: Event) => void;
  deleteEvent: (eventId: string) => void;
  clearEvents: () => void;
}

// Create a store with methods to manage events
export const useEventStore = create<EventStore>((set) => ({
  events: [],
  
  setEvents: (events) => set({ events }),
  
  addEvent: (event) => set((state) => ({ 
    events: [...state.events, event] 
  })),
  
  updateEvent: (updatedEvent) => set((state) => ({ 
    events: state.events.map(event => 
      event.id === updatedEvent.id ? updatedEvent : event
    ) 
  })),
  
  deleteEvent: (eventId) => set((state) => ({ 
    events: state.events.filter(event => event.id !== eventId) 
  })),
  
  clearEvents: () => set({ events: [] }),
})); 