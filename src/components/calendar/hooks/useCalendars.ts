'use client';
import { useState, useEffect, useCallback } from 'react';
import type { GCalCalendar } from '../types';

export class ReconnectError extends Error {
  reconnectRequired = true;
  constructor(message: string) {
    super(message);
    this.name = 'ReconnectError';
  }
}

export function useCalendars() {
  const [data, setData] = useState<GCalCalendar[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/calendar/calendars');
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.reconnectRequired) throw new ReconnectError(json.error ?? 'Calendar disconnected');
        throw new Error(json.error ?? 'Failed to fetch calendars');
      }
      const json = await res.json();
      setData(json.calendars ?? []);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { data, error, isLoading, refetch: fetch_ };
}
