'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GCalEvent, EventEditorValues, UpdateScope } from '../types';
import { ReconnectError } from './useCalendars';

interface FetchParams {
  calendarIds: string[];
  timeMin: string;
  timeMax: string;
}

export function useEvents(params: FetchParams) {
  const [data, setData] = useState<GCalEvent[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!params.calendarIds.length) return;
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        calendarIds: params.calendarIds.join(','),
        timeMin: params.timeMin,
        timeMax: params.timeMax,
      });
      const res = await fetch(`/api/calendar/events?${q}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.reconnectRequired) throw new ReconnectError(json.error ?? 'Calendar disconnected');
        throw new Error(json.error ?? 'Failed to fetch events');
      }
      const json = await res.json();
      setData(json.events ?? []);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [params.calendarIds.join(','), params.timeMin, params.timeMax]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { data, error, isLoading, refetch: fetch_ };
}

export function useCreateEvent(onSettled: () => void) {
  const [isLoading, setIsLoading] = useState(false);

  const mutateAsync = useCallback(async ({
    calendarId,
    event,
    addMeet,
  }: {
    calendarId: string;
    event: EventEditorValues;
    addMeet: boolean;
  }) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId, event, addMeet }),
      });
      if (!res.ok) throw new Error('Failed to create event');
      const json = await res.json();
      onSettled();
      return json;
    } finally {
      setIsLoading(false);
    }
  }, [onSettled]);

  return { mutateAsync, isLoading };
}

export function useUpdateEvent(onSettled: () => void) {
  const [isLoading, setIsLoading] = useState(false);

  const mutateAsync = useCallback(async ({
    id,
    calendarId,
    event,
    updateScope = 'single',
  }: {
    id: string;
    calendarId: string;
    event: Partial<EventEditorValues>;
    updateScope?: UpdateScope;
  }) => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams({ calendarId, updateScope });
      const res = await fetch(`/api/calendar/events/${id}?${q}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      });
      if (!res.ok) throw new Error('Failed to update event');
      const json = await res.json();
      onSettled();
      return json;
    } finally {
      setIsLoading(false);
    }
  }, [onSettled]);

  return { mutateAsync, isLoading };
}

export function useDeleteEvent(onSettled: () => void) {
  const [isLoading, setIsLoading] = useState(false);

  const mutateAsync = useCallback(async ({
    id,
    calendarId,
    updateScope = 'single',
  }: {
    id: string;
    calendarId: string;
    updateScope?: UpdateScope;
  }) => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams({ calendarId, updateScope });
      const res = await fetch(`/api/calendar/events/${id}?${q}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete event');
      const json = await res.json();
      onSettled();
      return json;
    } finally {
      setIsLoading(false);
    }
  }, [onSettled]);

  return { mutateAsync, isLoading };
}
