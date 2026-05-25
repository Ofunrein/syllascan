'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  selectedDate: Date;
  onSelect: (date: Date) => void;
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function isToday(d: Date) {
  return isSameDay(d, new Date());
}

export function MiniMonth({ selectedDate, onSelect }: Props) {
  const [viewMonth, setViewMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  useEffect(() => {
    setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  const prev = () => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const next = () => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="w-full select-none">
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={prev} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white">
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-semibold text-white/80">{monthLabel}</span>
        <button onClick={next} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white">
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] text-white/40 pb-1">{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const selected = isSameDay(date, selectedDate);
          const today = isToday(date);
          return (
            <button
              key={i}
              onClick={() => onSelect(date)}
              className={[
                'text-[11px] h-6 w-full rounded flex items-center justify-center transition-colors',
                selected ? 'bg-blue-500 text-white font-bold' :
                today ? 'text-blue-400 font-bold hover:bg-white/10' :
                'text-white/70 hover:bg-white/10',
              ].join(' ')}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
