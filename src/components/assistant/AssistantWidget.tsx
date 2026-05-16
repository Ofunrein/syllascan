'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Minimize2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useAssistant } from './useAssistant';
import { ConversationThread } from './ConversationThread';
import { InputBar } from './InputBar';
import type { AssistantAction } from './types';

const POS_KEY = 'assistant.position';

function useDrag(enabled: boolean) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const s = localStorage.getItem(POS_KEY); if (s) setPos(JSON.parse(s)); } catch {}
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!enabled) return;
    dragging.current = true;
    const r = widgetRef.current!.getBoundingClientRect();
    offset.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const x = Math.max(0, Math.min(window.innerWidth - 400, e.clientX - offset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - offset.current.y));
      setPos({ x, y });
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setPos(p => { if (p) localStorage.setItem(POS_KEY, JSON.stringify(p)); return p; });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  return { widgetRef, pos, onMouseDown };
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const { user, googleCalendarConnected } = useAuth();
  const { widgetRef, pos, onMouseDown } = useDrag(open);
  const assistant = useAssistant({ userId: user?.id ?? null, calendarEvents: [] });

  const handleFileSelect = useCallback(async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) return;
      const data = await res.json();
      const events = data.events ?? [];
      if (events.length > 0) {
        await assistant.sendMessage(`I uploaded "${file.name}" and found ${events.length} event(s). Please show them for confirmation.`);
      }
    } catch {}
  }, [assistant]);

  const handleConfirmActions = useCallback(async (msgIndex: number, actions: AssistantAction[]) => {
    for (const action of actions) {
      if (action.type === 'CREATE') {
        await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendarId: action.event.calendarId ?? 'primary', event: action.event, addMeet: false }),
        });
      } else if (action.type === 'EDIT') {
        const q = new URLSearchParams({ calendarId: action.calendarId, updateScope: 'single' });
        await fetch(`/api/calendar/events/${action.eventId}?${q}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: action.changes }),
        });
      } else if (action.type === 'MOVE') {
        const q = new URLSearchParams({ calendarId: action.calendarId, updateScope: 'single' });
        await fetch(`/api/calendar/events/${action.eventId}?${q}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: { start: action.newStart, end: action.newEnd } }),
        });
      } else if (action.type === 'DELETE') {
        const q = new URLSearchParams({ calendarId: action.calendarId, updateScope: 'single' });
        await fetch(`/api/calendar/events/${action.eventId}?${q}`, { method: 'DELETE' });
      }
    }
    await assistant.markConfirmed(msgIndex);
  }, [assistant]);

  const handleDismissActions = useCallback((msgIndex: number) => {
    assistant.markConfirmed(msgIndex);
  }, [assistant]);

  const style: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
    : { position: 'fixed', bottom: '80px', right: '20px' };

  if (!user) return null;

  if (!open) {
    return (
      <div style={style} className="z-[9990]">
        <button
          onClick={() => setOpen(true)}
          className="w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95"
          style={{ background: 'rgba(15,23,42,0.80)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.15)' }}
          title="Open assistant"
        >
          <Sparkles size={19} className="text-blue-400" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={widgetRef}
      style={{
        ...style,
        width: 'min(380px, calc(100vw - 24px))',
        height: 'min(520px, calc(100vh - 120px))',
        background: 'rgba(10,16,30,0.84)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '1rem',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        zIndex: 9990,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        onMouseDown={onMouseDown}
        className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 cursor-grab active:cursor-grabbing select-none shrink-0"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-blue-400" />
          <span className="text-sm font-semibold text-white/90">SyllaScan Assistant</span>
        </div>
        <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/10 text-white/35 hover:text-white transition-colors">
          <Minimize2 size={13} />
        </button>
      </div>

      <ConversationThread
        messages={assistant.messages}
        loading={assistant.loading}
        onConfirmActions={handleConfirmActions}
        onDismissActions={handleDismissActions}
      />

      <InputBar
        onSend={assistant.sendMessage}
        onFileSelect={handleFileSelect}
        onRecordStart={assistant.startRecording}
        onRecordStop={assistant.stopRecording}
        recording={assistant.recording}
        loading={assistant.loading}
        disabled={!googleCalendarConnected}
      />

      {!googleCalendarConnected && (
        <div className="px-3 pb-2 text-xs text-yellow-400/60 text-center">
          Connect Google Calendar to create events
        </div>
      )}
    </div>
  );
}
