'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GCalEvent, EventEditorValues, UpdateScope } from '../types';

interface FetchParams {
  calendarIds: string[];
  timeMin: string;
  timeMax: string;
}

async function fetchEvents(params: FetchParams): Promise<GCalEvent[]> {
  const q = new URLSearchParams({
    calendarIds: params.calendarIds.join(','),
    timeMin: params.timeMin,
    timeMax: params.timeMax,
  });
  const res = await fetch(`/api/calendar/events?${q}`);
  if (!res.ok) throw new Error('Failed to fetch events');
  const data = await res.json();
  return data.events ?? [];
}

export function useEvents(params: FetchParams) {
  return useQuery({
    queryKey: ['events', params.calendarIds, params.timeMin, params.timeMax],
    queryFn: () => fetchEvents(params),
    enabled: params.calendarIds.length > 0,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      calendarId,
      event,
      addMeet,
    }: {
      calendarId: string;
      event: EventEditorValues;
      addMeet: boolean;
    }) => {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId, event, addMeet }),
      });
      if (!res.ok) throw new Error('Failed to create event');
      return res.json();
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['events'] });
      const snapshot = qc.getQueriesData<GCalEvent[]>({ queryKey: ['events'] });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        ctx.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
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
      const q = new URLSearchParams({ calendarId, updateScope });
      const res = await fetch(`/api/calendar/events/${id}?${q}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      });
      if (!res.ok) throw new Error('Failed to update event');
      return res.json();
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['events'] });
      const snapshot = qc.getQueriesData<GCalEvent[]>({ queryKey: ['events'] });
      qc.setQueriesData<GCalEvent[]>({ queryKey: ['events'] }, (old) => {
        if (!old) return old;
        return old.map(e => (e.id === vars.id ? { ...e, ...vars.event } : e));
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        ctx.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      calendarId,
      updateScope = 'single',
    }: {
      id: string;
      calendarId: string;
      updateScope?: UpdateScope;
    }) => {
      const q = new URLSearchParams({ calendarId, updateScope });
      const res = await fetch(`/api/calendar/events/${id}?${q}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete event');
      return res.json();
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['events'] });
      const snapshot = qc.getQueriesData<GCalEvent[]>({ queryKey: ['events'] });
      qc.setQueriesData<GCalEvent[]>({ queryKey: ['events'] }, (old) => {
        if (!old) return old;
        return old.filter(e => e.id !== vars.id);
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        ctx.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}
