'use client';
import type { GCalEvent } from './types';
import { eventStartDateKey, formatLocalDateKey } from './dateUtils';

interface Props {
  year: number;
  events: GCalEvent[];
  onMonthClick: (date: Date) => void;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function hasEvent(events: GCalEvent[], date: Date): boolean {
  const ds = formatLocalDateKey(date);
  return events.some(e => eventStartDateKey(e) === ds);
}

function renderMiniMonth(year: number, month: number, events: GCalEvent[], onMonthClick: (d: Date) => void) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const today = new Date();

  return (
    <div key={month} className="cursor-pointer group" onClick={() => onMonthClick(new Date(year, month, 1))}>
      <div className="text-xs font-semibold text-white/70 mb-1.5 group-hover:text-white transition-colors">
        {MONTHS[month]}
      </div>
      <div className="grid grid-cols-7 gap-0">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] text-white/30">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const date = new Date(year, month, day);
          const isToday = today.toDateString() === date.toDateString();
          const evt = hasEvent(events, date);
          return (
            <div key={i} className="flex items-center justify-center relative">
              <div className={[
                'text-[10px] w-5 h-5 rounded-full flex items-center justify-center',
                isToday ? 'bg-blue-500 text-white font-bold' :
                evt ? 'text-white' : 'text-white/50',
              ].join(' ')}>
                {day}
              </div>
              {evt && !isToday && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function YearView({ year, events, onMonthClick }: Props) {
  return (
    <div className="grid grid-cols-4 gap-6 p-4">
      {Array.from({ length: 12 }, (_, i) => renderMiniMonth(year, i, events, onMonthClick))}
    </div>
  );
}
