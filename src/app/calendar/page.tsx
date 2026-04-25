'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, momentLocalizer, Views, View } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import Header from '@/components/Header';
import { useAuth } from '@/components/AuthProvider';
import { useEventStore } from '@/lib/stores/eventStore';
import type { Event } from '@/lib/openai';

const localizer = momentLocalizer(moment);

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  source: 'supabase' | 'google';
  type?: string;
  category?: string;
  location?: string;
  description?: string;
}

function getUrgencyColor(event: CalendarEvent): string {
  if (event.source === 'google') return '#3b82f6'; // neutral blue

  const now = new Date();
  const daysUntil = Math.ceil((event.start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Color by type first
  if (event.type === 'exam') {
    if (daysUntil <= 1) return '#ef4444'; // red
    if (daysUntil <= 3) return '#f97316'; // orange
    if (daysUntil <= 7) return '#eab308'; // yellow
    return '#a855f7'; // purple for exams further out
  }
  if (event.type === 'assignment') {
    if (daysUntil <= 1) return '#ef4444';
    if (daysUntil <= 3) return '#f97316';
    if (daysUntil <= 7) return '#eab308';
    return '#22c55e'; // green
  }
  if (event.type === 'class') return '#6366f1'; // indigo
  if (event.type === 'meeting') return '#8b5cf6'; // violet
  if (event.type === 'reading') return '#14b8a6'; // teal
  if (event.type === 'discussion') return '#f59e0b'; // amber

  // Fallback urgency
  if (daysUntil <= 1) return '#ef4444';
  if (daysUntil <= 3) return '#f97316';
  if (daysUntil <= 7) return '#eab308';
  return '#22c55e';
}

function supabaseToCalEvent(event: Event): CalendarEvent {
  const date = event.date || event.startDate?.split('T')[0] || new Date().toISOString().split('T')[0];
  const startTime = event.startTime || '00:00';
  const endTime = event.endTime || (event.startTime ? moment(startTime, 'HH:mm').add(1, 'hour').format('HH:mm') : '23:59');

  return {
    id: event.id,
    title: event.title,
    start: new Date(`${date}T${startTime}:00`),
    end: new Date(`${date}T${endTime}:00`),
    allDay: event.isAllDay || false,
    source: 'supabase',
    type: event.type,
    category: event.category,
    location: event.location,
    description: event.description,
  };
}

function googleToCalEvent(event: any): CalendarEvent {
  return {
    id: event.id,
    title: event.title || event.summary,
    start: new Date(event.startDate || event.start),
    end: new Date(event.endDate || event.end),
    allDay: event.isAllDay || !event.startDate?.includes('T'),
    source: 'google',
    description: event.description,
    location: event.location,
  };
}

export default function CalendarPage() {
  const { user, googleCalendarConnected } = useAuth();
  const { events: supabaseEvents, fetchEvents, loading: eventsLoading } = useEventStore();

  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [currentView, setCurrentView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch Supabase events on mount
  useEffect(() => {
    if (user?.id) {
      fetchEvents(user.id);
    }
  }, [user?.id, fetchEvents]);

  // Fetch Google Calendar events
  const fetchGoogleEvents = useCallback(async () => {
    if (!googleCalendarConnected) return;
    setGoogleLoading(true);
    try {
      const timeMin = new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString();
      const timeMax = new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString();
      const params = new URLSearchParams({ timeMin, timeMax, calendarId: 'primary' });
      const res = await fetch(`/api/calendar/events?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setGoogleEvents((data.events || []).map(googleToCalEvent));
      }
    } catch (err) {
      console.error('Failed to fetch Google Calendar events:', err);
    } finally {
      setGoogleLoading(false);
    }
  }, [googleCalendarConnected]);

  useEffect(() => {
    fetchGoogleEvents();
  }, [fetchGoogleEvents]);

  // Merge events
  const mergedEvents = useMemo<CalendarEvent[]>(() => {
    const fromSupabase = supabaseEvents.map(supabaseToCalEvent);
    // Deduplicate: if a supabase event has a google_event_id, skip the matching google event
    const googleEventIdsInSupabase = new Set(
      supabaseEvents.filter(e => e.google_event_id).map(e => e.google_event_id)
    );
    const filteredGoogle = googleEvents.filter(ge => !googleEventIdsInSupabase.has(ge.id));
    return [...fromSupabase, ...filteredGoogle];
  }, [supabaseEvents, googleEvents]);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const bg = getUrgencyColor(event);
    return {
      style: {
        backgroundColor: bg,
        color: '#fff',
        borderRadius: '4px',
        border: 'none',
        fontWeight: 600,
        padding: '2px 6px',
        fontSize: '0.85rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      },
    };
  }, []);

  const isLoading = eventsLoading || googleLoading;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Calendar</h1>
            <p className="text-white/50 text-sm mt-1">
              All your events in one place
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-white/60">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] inline-block" />
                Google
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] inline-block" />
                Academic
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] inline-block" />
                Urgent
              </span>
            </div>
            <button
              onClick={() => { fetchGoogleEvents(); if (user?.id) fetchEvents(user.id); }}
              disabled={isLoading}
              className="px-3 py-1.5 bg-white/10 text-white rounded-full hover:bg-white/15 transition text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div className="liquid-glass rounded-2xl overflow-hidden p-4" style={{ minHeight: '650px' }}>
          {isLoading && mergedEvents.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/80" />
            </div>
          ) : (
            <div style={{ height: '620px' }}>
              <style jsx global>{`
                /* Dark-themed react-big-calendar overrides */
                .rbc-calendar {
                  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  color: #e2e8f0;
                  background: transparent;
                }
                .rbc-header {
                  padding: 10px 3px;
                  font-weight: 600;
                  font-size: 0.9rem;
                  background-color: rgba(255,255,255,0.05);
                  border-bottom: 1px solid rgba(255,255,255,0.1);
                  color: #e2e8f0;
                }
                .rbc-month-view {
                  border: 1px solid rgba(255,255,255,0.1);
                  border-radius: 0.5rem;
                  overflow: hidden;
                }
                .rbc-day-bg {
                  background: transparent;
                }
                .rbc-day-bg.rbc-today {
                  background-color: rgba(59,130,246,0.15);
                }
                .rbc-off-range-bg {
                  background-color: rgba(0,0,0,0.15);
                }
                .rbc-date-cell {
                  padding: 5px;
                  font-size: 0.9rem;
                  text-align: right;
                  color: #e2e8f0;
                }
                .rbc-date-cell.rbc-now {
                  font-weight: bold;
                  color: #93c5fd;
                }
                .rbc-off-range {
                  color: rgba(255,255,255,0.25);
                }
                .rbc-event {
                  border-radius: 4px;
                  color: white;
                  padding: 2px 5px;
                  font-size: 0.85rem;
                  border: none;
                  font-weight: 500;
                }
                .rbc-event.rbc-selected {
                  box-shadow: 0 0 0 2px #93c5fd;
                }
                .rbc-show-more {
                  color: #93c5fd;
                  font-weight: 500;
                  font-size: 0.8rem;
                  background: transparent;
                }
                .rbc-toolbar {
                  margin-bottom: 12px;
                  padding: 4px;
                  font-size: 0.9rem;
                }
                .rbc-toolbar button {
                  color: #e2e8f0;
                  background-color: rgba(255,255,255,0.08);
                  border: 1px solid rgba(255,255,255,0.15);
                  padding: 6px 12px;
                  border-radius: 0.375rem;
                  font-weight: 500;
                }
                .rbc-toolbar button:hover {
                  background-color: rgba(255,255,255,0.15);
                }
                .rbc-toolbar button.rbc-active {
                  background-color: #3b82f6;
                  color: white;
                  border-color: #2563eb;
                }
                .rbc-toolbar-label {
                  color: #f1f5f9;
                  font-weight: 600;
                }
                .rbc-day-bg + .rbc-day-bg,
                .rbc-header + .rbc-header {
                  border-left: 1px solid rgba(255,255,255,0.08);
                }
                .rbc-month-row + .rbc-month-row {
                  border-top: 1px solid rgba(255,255,255,0.08);
                }
                .rbc-header.rbc-today {
                  background-color: rgba(59,130,246,0.2);
                  color: #93c5fd;
                  font-weight: bold;
                }
                /* Time views */
                .rbc-time-view {
                  border: 1px solid rgba(255,255,255,0.1);
                  border-radius: 0.5rem;
                  overflow: hidden;
                }
                .rbc-time-content {
                  border-top: 1px solid rgba(255,255,255,0.1);
                }
                .rbc-time-header-content {
                  border-left: 1px solid rgba(255,255,255,0.1);
                }
                .rbc-time-slot {
                  color: rgba(255,255,255,0.4);
                }
                .rbc-time-view .rbc-time-gutter,
                .rbc-time-view .rbc-day-slot {
                  background: transparent;
                }
                .rbc-time-view .rbc-day-slot .rbc-time-slot {
                  border-top: 1px solid rgba(255,255,255,0.05);
                }
                .rbc-time-view .rbc-day-slot.rbc-today {
                  background-color: rgba(59,130,246,0.08);
                }
                .rbc-timeslot-group {
                  border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .rbc-time-view .rbc-allday-cell {
                  background: transparent;
                  border-bottom: 1px solid rgba(255,255,255,0.08);
                }
                .rbc-time-content .rbc-time-column {
                  background: transparent;
                }
                .rbc-current-time-indicator {
                  background-color: #ef4444;
                  height: 2px;
                }
                .rbc-day-slot .rbc-event {
                  border: 1px solid rgba(0,0,0,0.2);
                }
                /* Agenda view */
                .rbc-agenda-view table.rbc-agenda-table {
                  border: none;
                  background: transparent;
                  color: #e2e8f0;
                }
                .rbc-agenda-view table.rbc-agenda-table thead > tr > th {
                  background-color: rgba(255,255,255,0.05);
                  color: #e2e8f0;
                  border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
                  border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .rbc-agenda-view table.rbc-agenda-table tbody > tr:hover > td {
                  background-color: rgba(255,255,255,0.05);
                }
                .rbc-agenda-time-cell {
                  color: rgba(255,255,255,0.5);
                }
                .rbc-agenda-date-cell {
                  color: #93c5fd;
                }
                /* Overlay popup */
                .rbc-overlay {
                  background-color: rgba(15,23,42,0.95);
                  backdrop-filter: blur(12px);
                  border-radius: 8px;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                  border: 1px solid rgba(255,255,255,0.1);
                  padding: 10px;
                  z-index: 100;
                }
                .rbc-overlay-header {
                  font-weight: 600;
                  color: #f1f5f9;
                  border-bottom: 1px solid rgba(255,255,255,0.1);
                  margin-bottom: 6px;
                  padding-bottom: 6px;
                }
              `}</style>
              <Calendar
                localizer={localizer}
                events={mergedEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                defaultView={Views.MONTH}
                view={currentView}
                date={currentDate}
                onView={setCurrentView}
                onNavigate={setCurrentDate}
                tooltipAccessor={(event) => {
                  const e = event as CalendarEvent;
                  const parts = [e.title];
                  if (e.type) parts.push(`Type: ${e.type}`);
                  if (e.location) parts.push(`Location: ${e.location}`);
                  if (e.description) parts.push(e.description);
                  parts.push(`Source: ${e.source === 'google' ? 'Google Calendar' : 'SyllaScan'}`);
                  return parts.join('\n');
                }}
                eventPropGetter={eventStyleGetter}
                popup
                selectable
              />
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="mt-4 flex items-center justify-between text-xs text-white/40 px-1">
          <span>
            {mergedEvents.length} event{mergedEvents.length !== 1 ? 's' : ''} total
            {googleCalendarConnected && ` (${googleEvents.length} from Google)`}
          </span>
          <span>
            {supabaseEvents.length} academic event{supabaseEvents.length !== 1 ? 's' : ''}
          </span>
        </div>
      </main>
    </div>
  );
}
