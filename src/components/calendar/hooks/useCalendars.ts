'use client';
import { useQuery } from '@tanstack/react-query';
import type { GCalCalendar } from '../types';

async function fetchCalendars(): Promise<GCalCalendar[]> {
  const res = await fetch('/api/calendar/calendars');
  if (!res.ok) throw new Error('Failed to fetch calendars');
  const data = await res.json();
  return data.calendars ?? [];
}

export function useCalendars() {
  return useQuery({ queryKey: ['calendars'], queryFn: fetchCalendars });
}
