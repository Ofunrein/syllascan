'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import CalendarGrid from './CalendarGrid';
import { YearView } from './YearView';
import { EventPopover } from './EventPopover';
import { EventEditorModal } from './EventEditorModal';
import { RecurrencePrompt } from './RecurrencePrompt';
import { UndoToast } from './UndoToast';
import { useCalendars, ReconnectError } from './hooks/useCalendars';
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from './hooks/useEvents';
import type { GCalEvent, GCalCalendar, ViewMode, UndoRecord, EventEditorValues, UpdateScope } from './types';

const VIEW_LABELS: Record<ViewMode, string> = {
  day: 'Day', week: 'Week', month: 'Month', year: 'Year', schedule: 'Schedule',
};

const LS_KEY = 'calendar.visibleCalendars';

function loadVisible(calendars: GCalCalendar[]): Set<string> {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set(calendars.map(c => c.id).filter(Boolean));
}

function getViewRange(date: Date, view: ViewMode): { timeMin: string; timeMax: string } {
  const d = new Date(date);
  if (view === 'day') {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }
  if (view === 'week') {
    const day = d.getDay();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    const end = new Date(start.getTime() + 7 * 86400000);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }
  if (view === 'year') {
    return {
      timeMin: new Date(d.getFullYear(), 0, 1).toISOString(),
      timeMax: new Date(d.getFullYear() + 1, 0, 1).toISOString(),
    };
  }
  return {
    timeMin: new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString(),
    timeMax: new Date(d.getFullYear(), d.getMonth() + 2, 1).toISOString(),
  };
}

function formatViewTitle(date: Date, view: ViewMode): string {
  const opts: Intl.DateTimeFormatOptions = view === 'year'
    ? { year: 'numeric' }
    : view === 'day'
    ? { month: 'long', day: 'numeric', year: 'numeric' }
    : { month: 'long', year: 'numeric' };
  return date.toLocaleDateString('en-US', opts);
}

function navigate(date: Date, view: ViewMode, dir: 1 | -1): Date {
  const d = new Date(date);
  if (view === 'day') d.setDate(d.getDate() + dir);
  else if (view === 'week') d.setDate(d.getDate() + dir * 7);
  else if (view === 'year') d.setFullYear(d.getFullYear() + dir);
  else d.setMonth(d.getMonth() + dir);
  return d;
}

export function CalendarShell() {
  const [view, setView] = useState<ViewMode>('month');
  const [date, setDate] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set());

  const [popover, setPopover] = useState<{ event: GCalEvent; x: number; y: number } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<GCalEvent | null>(null);
  const [defaultSlot, setDefaultSlot] = useState<{ start: string; end: string } | null>(null);
  const [recurrencePrompt, setRecurrencePrompt] = useState<{
    action: 'edit' | 'delete';
    event: GCalEvent;
    pendingScope?: UpdateScope;
  } | null>(null);
  const [undoRecord, setUndoRecord] = useState<UndoRecord | null>(null);
  const [reconnectRequired, setReconnectRequired] = useState(false);
  const [pendingRecurrenceScope, setPendingRecurrenceScope] = useState<UpdateScope>('single');

  const { data: calendars = [], error: calendarsError, refetch: refetchCalendars } = useCalendars();
  const { timeMin, timeMax } = getViewRange(date, view);
  const visibleIds = useMemo(() => Array.from(visibleCalendars), [visibleCalendars]);
  const { data: rawEvents = [], error: eventsError, refetch: refetchEvents } = useEvents({ calendarIds: visibleIds, timeMin, timeMax });

  // Join calendarColor from calendar list
  const calColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    calendars.forEach(c => { m[c.id] = c.backgroundColor; });
    return m;
  }, [calendars]);
  const allEvents = useMemo(
    () => rawEvents.map(e => ({ ...e, calendarColor: calColorMap[e.calendarId] ?? '#3b82f6' })),
    [rawEvents, calColorMap]
  );

  // Surface reconnect requirement from query errors
  useEffect(() => {
    if (calendarsError instanceof ReconnectError || eventsError instanceof ReconnectError) {
      setReconnectRequired(true);
    }
  }, [calendarsError, eventsError]);

  const refetch = useCallback(() => { refetchEvents(); }, [refetchEvents]);
  const createEvent = useCreateEvent(refetch);
  const updateEvent = useUpdateEvent(refetch);
  const deleteEvent = useDeleteEvent(refetch);

  useEffect(() => {
    if (calendars.length > 0 && visibleCalendars.size === 0) {
      setVisibleCalendars(loadVisible(calendars));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendars]);

  useEffect(() => {
    if (visibleCalendars.size > 0) {
      localStorage.setItem(LS_KEY, JSON.stringify(Array.from(visibleCalendars)));
    }
  }, [visibleCalendars]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        e.key === 'c' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)
      ) {
        setEditorOpen(true);
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);

  const toggleCalendar = (id: string) => {
    setVisibleCalendars(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleEventClick = useCallback((event: GCalEvent) => {
    // Position near center of viewport as fallback since CalendarGrid passes the GCalEvent directly
    setPopover({ event, x: window.innerWidth / 2, y: window.innerHeight / 3 });
  }, []);

  const handleSlotClick = useCallback((slotDate: Date) => {
    const start = slotDate.toISOString();
    const end = new Date(slotDate.getTime() + 60 * 60 * 1000).toISOString();
    setDefaultSlot({ start, end });
    setEditingEvent(null);
    setEditorOpen(true);
  }, []);

  const handleCreate = async (values: EventEditorValues, calId: string) => {
    setEditorOpen(false);
    await createEvent.mutateAsync({ calendarId: calId, event: values, addMeet: values.addMeet });
    setUndoRecord({ action: 'create', eventId: '', calendarId: calId });
  };

  const handleUpdate = async (values: EventEditorValues, calId: string, updateScope: UpdateScope = 'single') => {
    if (!editingEvent) return;
    const prev = { ...editingEvent };
    setEditorOpen(false);
    setEditingEvent(null);
    await updateEvent.mutateAsync({ id: prev.id, calendarId: calId, event: values, updateScope });
    setUndoRecord({ action: 'update', eventId: prev.id, calendarId: calId, previousState: prev });
  };

  const handleDeleteConfirmed = async (event: GCalEvent, updateScope: UpdateScope = 'single') => {
    const prev = { ...event };
    await deleteEvent.mutateAsync({ id: event.id, calendarId: event.calendarId, updateScope });
    setUndoRecord({ action: 'delete', eventId: event.id, calendarId: event.calendarId, previousState: prev });
  };

  const handleEditEvent = (event: GCalEvent) => {
    if (event.recurringEventId) {
      setRecurrencePrompt({ action: 'edit', event });
    } else {
      setEditingEvent(event);
      setEditorOpen(true);
    }
  };

  const handleDeleteEvent = (event: GCalEvent) => {
    if (event.recurringEventId) {
      setRecurrencePrompt({ action: 'delete', event });
    } else {
      handleDeleteConfirmed(event, 'single');
    }
  };

  const handleRecurrenceSelect = (scope: UpdateScope) => {
    if (!recurrencePrompt) return;
    const { action, event } = recurrencePrompt;
    setRecurrencePrompt(null);
    if (action === 'delete') {
      handleDeleteConfirmed(event, scope);
    } else {
      // Store the scope so handleUpdate can pass it to the API
      setRecurrencePrompt(null);
      setEditingEvent(event);
      setEditorOpen(true);
      // Carry scope via a ref-like mechanism: store on the pending edit state
      setPendingRecurrenceScope(scope);
    }
  };

  const handleUndo = async (record: UndoRecord) => {
    setUndoRecord(null);
    if (record.action === 'delete' && record.previousState) {
      const prev = record.previousState as GCalEvent;
      await createEvent.mutateAsync({
        calendarId: record.calendarId,
        event: {
          title: prev.title,
          allDay: prev.allDay,
          start: prev.start,
          end: prev.end,
          description: prev.description ?? '',
          location: prev.location ?? '',
          color: prev.color ?? '',
          calendarId: record.calendarId,
          recurrence: prev.recurrence ?? '',
          guests: prev.attendees?.map(a => a.email) ?? [],
          addMeet: false,
        },
        addMeet: false,
      });
    }
    if (record.action === 'update' && record.previousState) {
      const prev = record.previousState as GCalEvent;
      await updateEvent.mutateAsync({
        id: record.eventId,
        calendarId: record.calendarId,
        event: {
          title: prev.title,
          allDay: prev.allDay,
          start: prev.start,
          end: prev.end,
          description: prev.description,
          location: prev.location,
        },
        updateScope: 'single',
      });
    }
  };

  const handleEventDrop = async (event: GCalEvent) => {
    await updateEvent.mutateAsync({ id: event.id, calendarId: event.calendarId, event: { start: event.start, end: event.end } });
  };

  const handleEventResize = async (event: GCalEvent) => {
    await updateEvent.mutateAsync({ id: event.id, calendarId: event.calendarId, event: { start: event.start, end: event.end } });
  };

  const handleDuplicate = async (event: GCalEvent) => {
    const calId = calendars.find(c => c.primary)?.id ?? event.calendarId;
    await createEvent.mutateAsync({
      calendarId: calId,
      event: {
        title: `${event.title} (copy)`,
        allDay: event.allDay,
        start: event.start,
        end: event.end,
        description: event.description ?? '',
        location: event.location ?? '',
        color: event.color ?? '',
        calendarId: calId,
        recurrence: '',
        guests: [],
        addMeet: false,
      },
      addMeet: false,
    });
  };

  const primaryCalId = calendars.find(c => c.primary)?.id ?? calendars[0]?.id ?? 'primary';

  return (
    <div className="flex flex-col h-full">
      {/* Reconnect banner */}
      {reconnectRequired && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-4 py-2 flex items-center justify-between text-sm text-yellow-200">
          <span>Google Calendar disconnected. Reconnect to continue syncing.</span>
          <a
            href={`/api/google-calendar/authorize?next=${encodeURIComponent('/calendar')}`}
            className="ml-4 px-3 py-1 rounded-full bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-100 text-xs font-medium transition-colors"
          >
            Reconnect
          </a>
        </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <button
          onClick={() => setDate(new Date())}
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
        >
          Today
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate(d => navigate(d, view, -1))}
            className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setDate(d => navigate(d, view, 1))}
            className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <span className="text-base font-semibold text-white/90 flex-1">
          {formatViewTitle(date, view)}
        </span>
        {/* Desktop view switcher */}
        <div className="hidden sm:flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {(['day', 'week', 'month', 'year', 'schedule'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={[
                'px-3 py-1 rounded text-sm font-medium transition-colors',
                view === v ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80',
              ].join(' ')}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        {/* Mobile view switcher */}
        <select
          className="sm:hidden bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
          value={view}
          onChange={e => setView(e.target.value as ViewMode)}
        >
          {(['day', 'week', 'month', 'year', 'schedule'] as ViewMode[]).map(v => (
            <option key={v} value={v}>{VIEW_LABELS[v]}</option>
          ))}
        </select>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={[
            'transition-all duration-200 overflow-hidden border-r border-white/10 shrink-0',
            sidebarOpen ? 'w-56 opacity-100' : 'w-0 opacity-0',
          ].join(' ')}
        >
          <div className="w-56 h-full overflow-y-auto px-3">
            <Sidebar
              date={date}
              onDateChange={d => {
                setDate(d);
                if (view === 'year') setView('month');
              }}
              calendars={calendars}
              visibleCalendars={visibleCalendars}
              onToggleCalendar={toggleCalendar}
              onCreateEvent={() => {
                setEditingEvent(null);
                setDefaultSlot(null);
                setEditorOpen(true);
              }}
            />
          </div>
        </div>

        {/* Main grid */}
        <div className="flex-1 overflow-hidden">
          {view === 'year' ? (
            <YearView
              year={date.getFullYear()}
              events={allEvents}
              onMonthClick={d => {
                setDate(d);
                setView('month');
              }}
            />
          ) : (
            <CalendarGrid
              events={allEvents}
              calendars={calendars}
              view={view}
              date={date}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
            />
          )}
        </div>
      </div>

      {/* Event popover */}
      {popover && (
        <EventPopover
          event={popover.event}
          position={{ x: popover.x, y: popover.y }}
          onClose={() => setPopover(null)}
          onEdit={handleEditEvent}
          onDelete={handleDeleteEvent}
          onDuplicate={handleDuplicate}
        />
      )}

      {/* Event editor modal */}
      {editorOpen && (
        <EventEditorModal
          event={editingEvent}
          defaultStart={defaultSlot?.start}
          defaultEnd={defaultSlot?.end}
          calendars={calendars}
          defaultCalendarId={editingEvent?.calendarId ?? primaryCalId}
          onSave={(values, calId) => {
            if (editingEvent) {
              handleUpdate(values, calId, pendingRecurrenceScope);
              setPendingRecurrenceScope('single');
            } else {
              handleCreate(values, calId);
            }
          }}
          onClose={() => {
            setEditorOpen(false);
            setEditingEvent(null);
            setDefaultSlot(null);
          }}
        />
      )}

      {/* Recurrence scope selector */}
      {recurrencePrompt && (
        <RecurrencePrompt
          action={recurrencePrompt.action}
          onSelect={handleRecurrenceSelect}
          onCancel={() => setRecurrencePrompt(null)}
        />
      )}

      {/* Undo toast */}
      <UndoToast
        record={undoRecord}
        onUndo={handleUndo}
        onDismiss={() => setUndoRecord(null)}
      />
    </div>
  );
}
