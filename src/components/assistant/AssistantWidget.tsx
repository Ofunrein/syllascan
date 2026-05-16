'use client';
import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react';
import { Calendar, Minimize2, Mic, Plus, ArrowUp } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useAssistant } from './useAssistant';
import { ConversationThread } from './ConversationThread';
import { InputBar } from './InputBar';
import type { AssistantAction } from './types';

const POS_KEY = 'assistant.position';

function useDrag() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const s = localStorage.getItem(POS_KEY); if (s) setPos(JSON.parse(s)); } catch {}
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
    dragging.current = true;
    const r = widgetRef.current!.getBoundingClientRect();
    offset.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const x = Math.max(0, Math.min(window.innerWidth - 440, e.clientX - offset.current.x));
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
  const [collapsedText, setCollapsedText] = useState('');
  const [recording, setRecording] = useState(false);
  const { user, googleCalendarConnected } = useAuth();
  const { widgetRef, pos, onMouseDown } = useDrag();
  const fileRef = useRef<HTMLInputElement>(null);
  const assistant = useAssistant({ userId: user?.id ?? null, calendarEvents: [] });

  const handleCollapsedSend = useCallback(async () => {
    const text = collapsedText.trim();
    if (!text) return;
    setCollapsedText('');
    setOpen(true);
    setTimeout(() => assistant.sendMessage(text), 50);
  }, [collapsedText, assistant]);

  const handleCollapsedKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCollapsedSend(); }
  };

  const handleCollapsedMic = useCallback(async () => {
    if (recording) {
      const transcript = await assistant.stopRecording();
      setRecording(false);
      if (transcript) setCollapsedText(transcript);
    } else {
      await assistant.startRecording();
      setRecording(true);
    }
  }, [recording, assistant]);

  const handleFileSelect = useCallback(async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    setOpen(true);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) return;
      const data = await res.json();
      const events = data.events ?? [];
      if (events.length > 0) {
        setTimeout(() => assistant.sendMessage(`I uploaded "${file.name}" and found ${events.length} event(s). Please show them for confirmation.`), 100);
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
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: action.changes }),
        });
      } else if (action.type === 'MOVE') {
        const q = new URLSearchParams({ calendarId: action.calendarId, updateScope: 'single' });
        await fetch(`/api/calendar/events/${action.eventId}?${q}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
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

  const baseStyle: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
    : { position: 'fixed', bottom: '24px', right: '24px' };

  if (!user) return null;

  // ── Collapsed: ChatGPT-style two-row input bar ──────────────────────
  if (!open) {
    // Recording / listening mode — full-width waveform bar
    if (recording) {
      return (
        <div
          ref={widgetRef}
          onMouseDown={onMouseDown}
          style={{
            ...baseStyle,
            width: 'min(440px, calc(100vw - 32px))',
            background: 'linear-gradient(135deg, rgba(20,22,32,0.90) 0%, rgba(20,30,60,0.90) 100%)',
            backdropFilter: 'blur(28px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '999px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
            zIndex: 9990,
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: '12px',
          }}
        >
          {/* Cancel */}
          <button
            onClick={async () => { await assistant.stopRecording(); setRecording(false); }}
            className="w-9 h-9 rounded-full flex items-center justify-center border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>

          {/* Waveform + label */}
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-end gap-[3px]" style={{ height: '32px' }}>
              {[0,1,2,3,4,5].map(i => <div key={i} className="wave-bar" />)}
            </div>
            <span className="text-white/70 text-sm font-medium">Listening</span>
          </div>

          {/* Send */}
          <button
            onClick={async () => { const t = await assistant.stopRecording(); setRecording(false); if (t) { setOpen(true); setTimeout(() => assistant.sendMessage(t), 50); } }}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 hover:bg-white/90 transition-colors"
          >
            <ArrowUp size={16} className="text-black" />
          </button>
        </div>
      );
    }

    return (
      <div
        ref={widgetRef}
        onMouseDown={onMouseDown}
        style={{
          ...baseStyle,
          width: 'min(440px, calc(100vw - 32px))',
          background: 'rgba(28, 28, 33, 0.80)',
          backdropFilter: 'blur(28px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '18px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.06) inset',
          zIndex: 9990,
          cursor: 'move',
          padding: '12px 14px 10px',
        }}
      >
        {/* Row 1: text input */}
        <input
          type="text"
          value={collapsedText}
          onChange={e => setCollapsedText(e.target.value)}
          onKeyDown={handleCollapsedKey}
          placeholder="Ask anything"
          className="w-full bg-transparent outline-none text-white/90 text-[15px] placeholder-white/35 mb-3 cursor-text"
          style={{ fontFamily: 'inherit' }}
        />

        {/* Row 2: action row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/75 hover:bg-white/8 transition-colors"
              title="Upload file"
            >
              <Plus size={16} />
            </button>
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />

            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-white/35 hover:text-white/65 hover:bg-white/8 transition-colors text-xs font-medium"
              title="Open full chat"
            >
              <Calendar size={13} className="text-white/35" />
              <span>SyllaScan AI</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCollapsedMic}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/75 hover:bg-white/8 transition-colors"
              title="Voice input"
            >
              <Mic size={15} />
            </button>

            <button
              onClick={handleCollapsedSend}
              disabled={!collapsedText.trim()}
              className={['w-8 h-8 flex items-center justify-center rounded-full transition-all',
                collapsedText.trim() ? 'bg-white text-black hover:bg-white/90' : 'bg-white/12 text-white/30',
              ].join(' ')}
              title="Send"
            >
              <ArrowUp size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Expanded panel ──────────────────────────────────────────────────
  return (
    <div
      ref={widgetRef}
      style={{
        ...baseStyle,
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
          <Calendar size={13} className="text-white/60" />
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
