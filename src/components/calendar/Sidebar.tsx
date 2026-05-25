'use client';
import { Plus } from 'lucide-react';
import { MiniMonth } from './MiniMonth';
import type { GCalCalendar } from './types';

interface Props {
  date: Date;
  onDateChange: (d: Date) => void;
  calendars: GCalCalendar[];
  visibleCalendars: Set<string>;
  onToggleCalendar: (id: string) => void;
  onCreateEvent: () => void;
}

export function Sidebar({ date, onDateChange, calendars, visibleCalendars, onToggleCalendar, onCreateEvent }: Props) {
  const myCalendars = calendars.filter(c => c.accessRole === 'owner' || c.accessRole === 'writer');
  const otherCalendars = calendars.filter(c => c.accessRole === 'reader' || c.accessRole === 'freeBusyReader');

  return (
    <aside className="w-full flex flex-col gap-4 py-4">
      <button
        onClick={onCreateEvent}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/[0.08] dark:bg-white/10 hover:bg-black/[0.12] dark:hover:bg-white/15 text-black dark:text-white font-semibold text-sm shadow-lg border border-black/10 dark:border-white/10 transition-colors w-fit"
      >
        <Plus size={16} />
        Create
      </button>

      <MiniMonth selectedDate={date} onSelect={onDateChange} />

      {myCalendars.length > 0 && (
        <div>
          <div className="text-[11px] text-black/[0.45] dark:text-white/40 uppercase tracking-widest mb-2 px-1">My calendars</div>
          <ul className="space-y-0.5">
            {myCalendars.map(cal => (
              <CalendarToggleRow
                key={cal.id}
                cal={cal}
                checked={visibleCalendars.has(cal.id)}
                onToggle={() => onToggleCalendar(cal.id)}
              />
            ))}
          </ul>
        </div>
      )}

      {otherCalendars.length > 0 && (
        <div>
          <div className="text-[11px] text-black/[0.45] dark:text-white/40 uppercase tracking-widest mb-2 px-1">Other calendars</div>
          <ul className="space-y-0.5">
            {otherCalendars.map(cal => (
              <CalendarToggleRow
                key={cal.id}
                cal={cal}
                checked={visibleCalendars.has(cal.id)}
                onToggle={() => onToggleCalendar(cal.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

function CalendarToggleRow({
  cal,
  checked,
  onToggle,
}: {
  cal: GCalCalendar;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="flex items-center gap-2 px-1 py-1 rounded hover:bg-black/[0.05] dark:hover:bg-white/5 cursor-pointer">
        <span
          className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          style={{
            borderColor: cal.backgroundColor,
            backgroundColor: checked ? cal.backgroundColor : 'transparent',
          }}
          onClick={onToggle}
        >
          {checked && <span className="text-white text-[8px] leading-none">✓</span>}
        </span>
        <span className="text-sm text-black/[0.75] dark:text-white/70 truncate">{cal.summary}</span>
      </label>
    </li>
  );
}
