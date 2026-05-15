'use client';
import { useState } from 'react';

interface Props {
  value: string;
  onChange: (rrule: string) => void;
}

type Preset = 'none' | 'daily' | 'weekly' | 'monthly-date' | 'monthly-nth' | 'yearly' | 'custom';

const DAYS = ['SU','MO','TU','WE','TH','FR','SA'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function RecurrenceBuilder({ value, onChange }: Props) {
  const [preset, setPreset] = useState<Preset>(() => {
    if (!value) return 'none';
    if (value.includes('FREQ=DAILY')) return 'daily';
    if (value.includes('FREQ=WEEKLY')) return 'weekly';
    if (value.includes('FREQ=MONTHLY')) return 'monthly-date';
    if (value.includes('FREQ=YEARLY')) return 'yearly';
    return 'custom';
  });
  const [weekDays, setWeekDays] = useState<string[]>(['MO']);
  const [interval, setInterval] = useState(1);

  const build = (p: Preset, days = weekDays, iv = interval) => {
    if (p === 'none') { onChange(''); return; }
    if (p === 'daily') { onChange(`RRULE:FREQ=DAILY;INTERVAL=${iv}`); return; }
    if (p === 'weekly') {
      const by = days.length ? `;BYDAY=${days.join(',')}` : '';
      onChange(`RRULE:FREQ=WEEKLY;INTERVAL=${iv}${by}`);
      return;
    }
    if (p === 'monthly-date') { onChange(`RRULE:FREQ=MONTHLY;INTERVAL=${iv}`); return; }
    if (p === 'monthly-nth') { onChange(`RRULE:FREQ=MONTHLY;INTERVAL=${iv};BYDAY=1MO`); return; }
    if (p === 'yearly') { onChange(`RRULE:FREQ=YEARLY`); return; }
  };

  const setP = (p: Preset) => { setPreset(p); build(p); };
  const toggleDay = (d: string) => {
    const next = weekDays.includes(d) ? weekDays.filter(x => x !== d) : [...weekDays, d];
    setWeekDays(next);
    build(preset, next);
  };

  return (
    <div className="space-y-2">
      <select
        value={preset}
        onChange={e => setP(e.target.value as Preset)}
        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white"
      >
        <option value="none">Does not repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly-date">Monthly on this date</option>
        <option value="monthly-nth">Monthly on nth weekday</option>
        <option value="yearly">Annually</option>
        {value && !['none','daily','weekly','monthly-date','monthly-nth','yearly'].includes(preset) && (
          <option value="custom">Custom (RRULE)</option>
        )}
      </select>

      {(preset === 'daily' || preset === 'weekly') && (
        <div className="flex items-center gap-2 text-sm text-white/70">
          <span>Every</span>
          <input
            type="number"
            min={1}
            value={interval}
            onChange={e => { const iv = Number(e.target.value); setInterval(iv); build(preset, weekDays, iv); }}
            className="w-14 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm"
          />
          <span>{preset === 'daily' ? 'day(s)' : 'week(s)'}</span>
        </div>
      )}

      {preset === 'weekly' && (
        <div className="flex gap-1 flex-wrap">
          {DAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={[
                'w-8 h-8 rounded-full text-xs font-medium transition-colors',
                weekDays.includes(d) ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20',
              ].join(' ')}
            >
              {DAY_LABELS[i].slice(0,1)}
            </button>
          ))}
        </div>
      )}

      {preset === 'custom' && (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="RRULE:FREQ=..."
          className="w-full bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white font-mono"
        />
      )}
    </div>
  );
}
