'use client';
import { useState } from 'react';
import { X, MapPin, AlignLeft, Users, Video, Repeat, Calendar } from 'lucide-react';
import type { GCalEvent, GCalCalendar, EventEditorValues } from './types';
import { GuestsInput } from './GuestsInput';
import { RecurrenceBuilder } from './RecurrenceBuilder';

interface Props {
  event?: GCalEvent | null;
  defaultStart?: string;
  defaultEnd?: string;
  calendars: GCalCalendar[];
  defaultCalendarId: string;
  onSave: (values: EventEditorValues, calendarId: string) => void;
  onClose: () => void;
}

const GOOGLE_COLORS = [
  { id: '1', label: 'Tomato', hex: '#d50000' },
  { id: '2', label: 'Flamingo', hex: '#e67c73' },
  { id: '3', label: 'Tangerine', hex: '#f4511e' },
  { id: '4', label: 'Banana', hex: '#f6bf26' },
  { id: '5', label: 'Sage', hex: '#33b679' },
  { id: '6', label: 'Basil', hex: '#0b8043' },
  { id: '7', label: 'Peacock', hex: '#039be5' },
  { id: '8', label: 'Blueberry', hex: '#3f51b5' },
  { id: '9', label: 'Lavender', hex: '#7986cb' },
  { id: '10', label: 'Grape', hex: '#8e24aa' },
  { id: '11', label: 'Graphite', hex: '#616161' },
];

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventEditorModal({ event, defaultStart, defaultEnd, calendars, defaultCalendarId, onSave, onClose }: Props) {
  const now = new Date();
  const oneHour = new Date(now.getTime() + 60*60*1000);

  const initStart = event ? toLocalDatetimeInput(event.start) :
    defaultStart ? toLocalDatetimeInput(defaultStart) :
    toLocalDatetimeInput(now.toISOString());
  const initEnd = event ? toLocalDatetimeInput(event.end) :
    defaultEnd ? toLocalDatetimeInput(defaultEnd) :
    toLocalDatetimeInput(oneHour.toISOString());

  const [title, setTitle] = useState(event?.title ?? '');
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [start, setStart] = useState(initStart);
  const [end, setEnd] = useState(initEnd);
  const [description, setDescription] = useState(event?.description ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [color, setColor] = useState(event?.color ?? '');
  const [calId, setCalId] = useState(event?.calendarId ?? defaultCalendarId);
  const [recurrence, setRecurrence] = useState(event?.recurrence ?? '');
  const [guests, setGuests] = useState<string[]>(event?.attendees?.map(a => a.email ?? '').filter(Boolean) ?? []);
  const [addMeet, setAddMeet] = useState(!!event?.hangoutLink);

  const writableCalendars = calendars.filter(c => c.accessRole === 'owner' || c.accessRole === 'writer');

  const submit = () => {
    if (!title.trim()) return;
    onSave(
      {
        title,
        allDay,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        description,
        location,
        color,
        calendarId: calId,
        recurrence,
        guests,
        addMeet,
      },
      calId
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1e293b] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/10">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{event ? 'Edit event' : 'New event'}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Title */}
          <input
            autoFocus
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Add title"
            className="w-full bg-transparent border-b border-white/20 focus:border-blue-500 pb-2 text-xl font-semibold text-white placeholder-white/30 outline-none"
          />

          {/* All-day toggle + time */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="accent-blue-500" />
              All day
            </label>
            {!allDay ? (
              <div className="flex items-center gap-2">
                <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white" />
                <span className="text-white/40 text-sm">→</span>
                <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input type="date" value={start.split('T')[0]} onChange={e => setStart(e.target.value + 'T00:00')}
                  className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white" />
                <span className="text-white/40 text-sm">→</span>
                <input type="date" value={end.split('T')[0]} onChange={e => setEnd(e.target.value + 'T00:00')}
                  className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white" />
              </div>
            )}
          </div>

          {/* Location */}
          <div className="flex items-start gap-2">
            <MapPin size={16} className="text-white/40 mt-2 shrink-0" />
            <input type="text" value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Add location"
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30" />
          </div>

          {/* Description */}
          <div className="flex items-start gap-2">
            <AlignLeft size={16} className="text-white/40 mt-2 shrink-0" />
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Add description"
              rows={2}
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 resize-none" />
          </div>

          {/* Color swatches */}
          <div className="flex flex-wrap gap-1.5">
            {GOOGLE_COLORS.map(c => (
              <button key={c.id} type="button" onClick={() => setColor(c.id)}
                title={c.label}
                className={['w-6 h-6 rounded-full transition-transform', color === c.id ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1e293b] scale-110' : 'hover:scale-110'].join(' ')}
                style={{ backgroundColor: c.hex }}
              />
            ))}
            <button type="button" onClick={() => setColor('')}
              className={['w-6 h-6 rounded-full bg-white/20 text-white/60 text-xs flex items-center justify-center transition-transform', !color ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1e293b]' : 'hover:scale-110'].join(' ')}>
              ✕
            </button>
          </div>

          {/* Calendar picker */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-white/40 shrink-0" />
            <select value={calId} onChange={e => setCalId(e.target.value)}
              className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white">
              {writableCalendars.map(c => (
                <option key={c.id} value={c.id}>{c.summary}</option>
              ))}
              {writableCalendars.length === 0 && (
                <option value={defaultCalendarId}>Primary Calendar</option>
              )}
            </select>
          </div>

          {/* Recurrence */}
          <div className="flex items-start gap-2">
            <Repeat size={16} className="text-white/40 mt-2 shrink-0" />
            <div className="flex-1">
              <RecurrenceBuilder value={recurrence} onChange={setRecurrence} />
            </div>
          </div>

          {/* Guests */}
          <div className="flex items-start gap-2">
            <Users size={16} className="text-white/40 mt-2.5 shrink-0" />
            <div className="flex-1">
              <GuestsInput value={guests} onChange={setGuests} />
            </div>
          </div>

          {/* Google Meet */}
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
            <Video size={16} className="text-white/40" />
            <input type="checkbox" checked={addMeet} onChange={e => setAddMeet(e.target.checked)} className="accent-blue-500" />
            Add Google Meet video conferencing
          </label>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={!title.trim()}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">
            {event ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
