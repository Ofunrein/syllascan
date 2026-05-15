'use client';
import { useQuery } from '@tanstack/react-query';
import type { GCalCalendar } from '../types';

export class ReconnectError extends Error {
  reconnectRequired = true;
  constructor(message: string) {
    super(message);
    this.name = 'ReconnectError';
  }
}

async function fetchCalendars(): Promise<GCalCalendar[]> {
  const res = await fetch('/api/calendar/calendars');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.reconnectRequired) throw new ReconnectError(data.error ?? 'Calendar disconnected');
    throw new Error(data.error ?? 'Failed to fetch calendars');
  }
  const data = await res.json();
  return data.calendars ?? [];
}

export function useCalendars() {
  return useQuery({ queryKey: ['calendars'], queryFn: fetchCalendars });
}
