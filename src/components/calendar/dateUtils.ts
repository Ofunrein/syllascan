import type { GCalEvent } from './types';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function formatLocalDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function parsePlainDateToLocalDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function eventStartDateKey(event: Pick<GCalEvent, 'start' | 'allDay'>): string {
  if (event.allDay || DATE_ONLY_RE.test(event.start)) return event.start.slice(0, 10);
  return formatLocalDateKey(new Date(event.start));
}

export function isSameLocalDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function clampMidnightEndToLocalDay(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return endIso;
  }

  if (
    end.getTime() > start.getTime() &&
    !isSameLocalDate(start, end) &&
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    end.getSeconds() === 0 &&
    end.getMilliseconds() === 0
  ) {
    const clamped = new Date(start);
    clamped.setHours(23, 59, 0, 0);
    return clamped.toISOString();
  }

  return endIso;
}
