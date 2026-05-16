'use client';

import '@schedule-x/theme-default/dist/index.css';

import { useCalendarApp, ScheduleXCalendar } from '@schedule-x/react';
import {
  viewDay,
  viewWeek,
  viewMonthGrid,
  viewMonthAgenda,
  CalendarApp,
} from '@schedule-x/calendar';
import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop';
import { createResizePlugin } from '@schedule-x/resize';
import { useEffect, useMemo } from 'react';

import type { GCalEvent, GCalCalendar, ViewMode } from './types';

// schedule-x uses 'YYYY-MM-DD HH:mm' for timed events and 'YYYY-MM-DD' for all-day
function toSXDateTime(iso: string, allDay: boolean): string {
  if (allDay) {
    // Return just the date portion
    return iso.slice(0, 10);
  }
  // Convert ISO 8601 like '2025-05-15T10:30:00Z' → '2025-05-15 10:30'
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function toSXViewName(view: ViewMode): string {
  switch (view) {
    case 'day':      return 'day';
    case 'week':     return 'week';
    case 'month':    return 'month-grid';
    case 'schedule': return 'month-agenda';
    // 'year' is handled by YearView; fall back to month-grid
    case 'year':     return 'month-grid';
    default:         return 'week';
  }
}

// Use the native/global Temporal that schedule-x itself uses.
// Importing a polyfill creates a different class, breaking instanceof checks.
function getNativeTemporalDate(dateStr: string): unknown | undefined {
  const T = (globalThis as unknown as { Temporal?: { PlainDate: { from: (s: string) => unknown } } }).Temporal;
  return T?.PlainDate?.from(dateStr);
}

function toSXDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface CalendarGridProps {
  events: GCalEvent[];
  calendars: GCalCalendar[];
  view: ViewMode;
  date: Date;
  onEventClick?: (event: GCalEvent) => void;
  onSlotClick?: (date: Date) => void;
  onEventDrop?: (event: GCalEvent) => void;
  onEventResize?: (event: GCalEvent) => void;
}

export default function CalendarGrid({
  events,
  calendars,
  view,
  date,
  onEventClick,
  onSlotClick,
  onEventDrop,
  onEventResize,
}: CalendarGridProps) {
  // Map GCalCalendar[] → schedule-x calendars record
  const sxCalendars = useMemo(() => {
    const record: Record<string, { colorName: string; lightColors: { main: string; container: string; onContainer: string }; darkColors: { main: string; container: string; onContainer: string } }> = {};
    for (const cal of calendars) {
      record[cal.id] = {
        colorName: cal.id,
        lightColors: {
          main: cal.backgroundColor,
          container: cal.backgroundColor + '33',
          onContainer: cal.foregroundColor,
        },
        darkColors: {
          main: cal.backgroundColor,
          container: cal.backgroundColor + '55',
          onContainer: cal.foregroundColor,
        },
      };
    }
    return record;
  }, [calendars]);

  // Map GCalEvent[] → schedule-x CalendarEventExternal[]
  const sxEvents = useMemo(
    () =>
      events.map((ev) => ({
        id: ev.id,
        title: ev.title,
        start: toSXDateTime(ev.start, ev.allDay),
        end: toSXDateTime(ev.end, ev.allDay),
        calendarId: ev.calendarId,
        description: ev.description,
        location: ev.location,
        // Store the original event for retrieval in callbacks
        _gcalEvent: ev,
      })),
    [events]
  );

  const calendarApp = useCalendarApp(
    {
      defaultView: toSXViewName(view),
      ...(getNativeTemporalDate(toSXDate(date)) ? { selectedDate: getNativeTemporalDate(toSXDate(date)) } : {}),
      views: [viewDay, viewWeek, viewMonthGrid, viewMonthAgenda],
      events: sxEvents,
      calendars: sxCalendars,
      callbacks: {
        onEventClick(sxEvent) {
          if (!onEventClick) return;
          const original = (sxEvent as Record<string, unknown>)['_gcalEvent'] as GCalEvent | undefined;
          if (original) onEventClick(original);
        },
        onClickDate(plainDate) {
          if (!onSlotClick) return;
          // Convert Temporal.PlainDate to JS Date
          const jsDate = new Date(plainDate.toString());
          onSlotClick(jsDate);
        },
        onClickDateTime(zonedDT) {
          if (!onSlotClick) return;
          const jsDate = new Date(zonedDT.epochMilliseconds);
          onSlotClick(jsDate);
        },
        onEventUpdate(sxEvent) {
          const original = (sxEvent as Record<string, unknown>)['_gcalEvent'] as GCalEvent | undefined;
          if (!original) return;
          // Build updated event with new start/end from schedule-x
          const updated: GCalEvent = {
            ...original,
            start: typeof sxEvent.start === 'string'
              ? sxEvent.start
              : new Date((sxEvent.start as { epochMilliseconds: number }).epochMilliseconds).toISOString(),
            end: typeof sxEvent.end === 'string'
              ? sxEvent.end
              : new Date((sxEvent.end as { epochMilliseconds: number }).epochMilliseconds).toISOString(),
          };
          // onEventUpdate fires for both DnD and resize; call only one handler to avoid double PATCH
          if (onEventDrop) onEventDrop(updated);
          else if (onEventResize) onEventResize(updated);
        },
      },
    },
    [createDragAndDropPlugin(), createResizePlugin()]
  );

  // Sync events when props change
  useEffect(() => {
    if (!calendarApp) return;
    calendarApp.events.set(sxEvents);
  }, [calendarApp, sxEvents]);

  // Sync view and date when props change
  useEffect(() => {
    if (!calendarApp) return;
    // Access internal $app to call calendarState.setView
    // CalendarApp wraps a private $app — access via any cast
    const internalApp = (calendarApp as unknown as { _app: { calendarState: { setView: (v: string, d: unknown) => void }; datePickerState: { selectedDate: { value: unknown } } } });
    try {
      // Try the internal $app path used by schedule-x v4
      const $app = (calendarApp as unknown as Record<string, unknown>)['$app'] as
        | { calendarState: { setView: (v: string, d: unknown) => void }; datePickerConfig: { selectedDate: { value: unknown } } }
        | undefined;
      if ($app?.calendarState?.setView) {
        // Temporal.PlainDate.from(string) — use the Temporal API available globally in v4
        const plainDate = getNativeTemporalDate(toSXDate(date));
        $app.calendarState.setView(toSXViewName(view), plainDate);
      }
    } catch {
      // If internal access fails, the initial config values are used (view/date only
      // change on mount). This is a known limitation when the private API is unavailable.
      void internalApp;
    }
  }, [calendarApp, view, date]);

  if (!calendarApp) return null;

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <ScheduleXCalendar calendarApp={calendarApp} />
    </div>
  );
}
