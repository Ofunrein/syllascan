'use client';
import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react';
import { X, Mic, Plus, ArrowUp, Minimize2, Square } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useAssistant } from './useAssistant';
import { ConversationThread } from './ConversationThread';
import type { AssistantAction } from './types';

const POS_KEY = 'assistant.position';
const NUM_BARS = 6;

// ── Real-time waveform hook ──────────────────────────────────────────
function useWaveform(active: boolean) {
  const [bars, setBars] = useState<number[]>(Array(NUM_BARS).fill(4));
  const animRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const start = useCallback(async (stream: MediaStream) => {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.7;
    const src = ctx.createMediaStreamSource(stream);
    src.connect(analyser);
    ctxRef.current = ctx;
    analyserRef.current = analyser;
    streamRef.current = stream;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      // Pick NUM_BARS evenly-spaced frequency bins, map 0-255 → 4-32px height
      const step = Math.floor(data.length / NUM_BARS);
      const heights = Array.from({ length: NUM_BARS }, (_, i) => {
        const v = data[i * step] / 255;
        return Math.max(4, Math.round(v * 28));
      });
      setBars(heights);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    analyserRef.current?.disconnect();
    ctxRef.current?.close();
    analyserRef.current = null;
    ctxRef.current = null;
    setBars(Array(NUM_BARS).fill(4));
  }, []);

  useEffect(() => { if (!active) stop(); }, [active, stop]);
  useEffect(() => () => { stop(); }, [stop]);

  return { bars, startWaveform: start, stopWaveform: stop };
}

// ── Drag hook ────────────────────────────────────────────────────────
function useDrag() {
  const [pos, setPos] = useState<{ right: number; bottom: number } | null>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(POS_KEY);
      if (s) {
        const p = JSON.parse(s);
        // Validate it's the right/bottom format (not legacy x/y) and within viewport
        if (typeof p.right === 'number' && typeof p.bottom === 'number'
          && p.right >= 0 && p.right < window.innerWidth
          && p.bottom >= 0 && p.bottom < window.innerHeight) {
          setPos(p);
        } else {
          // Stale/invalid position — clear it and use default bottom-right
          localStorage.removeItem(POS_KEY);
        }
      }
    } catch { localStorage.removeItem(POS_KEY); }
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
    dragging.current = true;
    const r = widgetRef.current!.getBoundingClientRect();
    offset.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const w = widgetRef.current?.offsetWidth ?? 440;
      const h = widgetRef.current?.offsetHeight ?? 80;
      const left = Math.max(0, Math.min(window.innerWidth - w,  e.clientX - offset.current.x));
      const top  = Math.max(0, Math.min(window.innerHeight - h, e.clientY - offset.current.y));
      setPos({ right: Math.max(0, window.innerWidth - left - w), bottom: Math.max(0, window.innerHeight - top - h) });
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

// ── Main widget ──────────────────────────────────────────────────────
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [collapsedText, setCollapsedText] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const { user, googleCalendarConnected } = useAuth();
  const { widgetRef, pos, onMouseDown } = useDrag();
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const assistant = useAssistant({ userId: user?.id ?? null, calendarEvents: [] });
  const { bars, startWaveform, stopWaveform } = useWaveform(recording);

  // ── Collapsed mic handling ─────────────────────────────────────────
  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecRef.current = rec;
      rec.start();
      setRecording(true);
      await startWaveform(stream);
    } catch { /* mic denied */ }
  }, [startWaveform]);

  const stopMic = useCallback((): Promise<string | null> => {
    return new Promise(resolve => {
      const rec = mediaRecRef.current;
      if (!rec) { resolve(null); return; }
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        rec.stream.getTracks().forEach(t => t.stop());
        stopWaveform();
        setRecording(false);
        setTranscribing(true);
        const form = new FormData();
        form.append('audio', blob, 'rec.webm');
        try {
          const res = await fetch('/api/voice/transcribe', { method: 'POST', body: form });
          const { transcript } = await res.json();
          resolve(transcript ?? null);
        } catch { resolve(null); }
        finally { setTranscribing(false); }
      };
      rec.stop();
    });
  }, [stopWaveform]);

  const handleStopAndPreview = useCallback(async () => {
    const text = await stopMic();
    if (text) setCollapsedText(text);
  }, [stopMic]);

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

  const handleFileSelect = useCallback(async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    setOpen(true);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) return;
      const data = await res.json();
      const events = data.events ?? [];
      if (events.length > 0)
        setTimeout(() => assistant.sendMessage(`I uploaded "${file.name}" and found ${events.length} event(s). Please show them for confirmation.`), 100);
    } catch {}
  }, [assistant]);

  const handleConfirmActions = useCallback(async (msgIndex: number, actions: AssistantAction[]) => {
    for (const action of actions) {
      if (action.type === 'CREATE') {
        await fetch('/api/calendar/events', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendarId: action.event.calendarId ?? 'primary', event: action.event, addMeet: false }) });
      } else if (action.type === 'EDIT') {
        const q = new URLSearchParams({ calendarId: action.calendarId, updateScope: 'single' });
        await fetch(`/api/calendar/events/${action.eventId}?${q}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: action.changes }) });
      } else if (action.type === 'MOVE') {
        const q = new URLSearchParams({ calendarId: action.calendarId, updateScope: 'single' });
        await fetch(`/api/calendar/events/${action.eventId}?${q}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: { start: action.newStart, end: action.newEnd } }) });
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
    ? { position: 'fixed', right: pos.right, bottom: pos.bottom }
    : { position: 'fixed', right: '24px', bottom: '24px' };

  if (!user) return null;

  // ── Collapsed bar ────────────────────────────────────────────────────
  if (!open) {
    return (
      <div
        ref={widgetRef}
        onMouseDown={onMouseDown}
        style={{
          ...baseStyle,
          width: 'min(440px, calc(100vw - 32px))',
          background: 'rgba(28, 28, 33, 0.82)',
          backdropFilter: 'blur(28px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '18px',
          boxShadow: recording
            ? '0 4px 24px rgba(0,0,0,0.55), 0 0 0 2px rgba(239,68,68,0.25)'
            : '0 4px 24px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.06) inset',
          zIndex: 9990,
          cursor: 'move',
          padding: '12px 14px 10px',
        }}
      >
        {/* Row 1: text OR waveform */}
        {recording ? (
          <div className="flex items-center gap-3 mb-3" style={{ height: '24px' }}>
            {/* Real-time waveform bars */}
            <div className="flex items-end gap-[3px]" style={{ height: '24px' }}>
              {bars.map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: '3px',
                    height: `${h}px`,
                    maxHeight: '24px',
                    borderRadius: '999px',
                    background: 'rgba(239,68,68,0.85)',
                    transition: 'height 0.05s ease',
                  }}
                />
              ))}
            </div>
            <span className="text-white/60 text-sm">
              {transcribing ? 'Transcribing...' : 'Listening...'}
            </span>
          </div>
        ) : (
          <input
            type="text"
            value={collapsedText}
            onChange={e => setCollapsedText(e.target.value)}
            onKeyDown={handleCollapsedKey}
            placeholder="Ask anything"
            className="w-full bg-transparent outline-none text-white/90 text-[15px] placeholder-white/35 mb-3 cursor-text"
            style={{ fontFamily: 'inherit' }}
          />
        )}

        {/* Row 2: actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {!recording && (
              <>
                <button onClick={() => fileRef.current?.click()}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/75 hover:bg-white/8 transition-colors">
                  <Plus size={16} />
                </button>
                <input ref={fileRef} type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
                <button onClick={() => setOpen(true)}
                  className="flex items-center h-8 px-2.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/8 transition-colors text-xs font-medium">
                  SyllaScan AI
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {recording ? (
              // Stop recording → show transcription for review
              <button
                onClick={handleStopAndPreview}
                disabled={transcribing}
                className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Square size={11} className="fill-current" />
                Stop
              </button>
            ) : (
              <button onClick={startMic}
                className="w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white/75 hover:bg-white/8 transition-colors">
                <Mic size={15} />
              </button>
            )}
            <button
              onClick={handleCollapsedSend}
              disabled={!collapsedText.trim() || recording}
              className={['w-8 h-8 flex items-center justify-center rounded-full transition-all',
                collapsedText.trim() && !recording ? 'bg-white text-black hover:bg-white/90' : 'bg-white/12 text-white/25'].join(' ')}>
              <ArrowUp size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Expanded panel ───────────────────────────────────────────────────
  return (
    <div
      ref={widgetRef}
      style={{
        ...baseStyle,
        width: 'min(420px, calc(100vw - 24px))',
        height: 'min(580px, calc(100vh - 40px))',
        background: 'rgba(13, 13, 15, 0.94)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: '20px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        zIndex: 9990,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header / drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing select-none"
      >
        <button onClick={() => setOpen(false)}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-white/8 hover:bg-white/15 text-white/50 hover:text-white transition-colors">
          <Minimize2 size={12} />
        </button>
        <span className="text-xs text-white/25 font-medium tracking-wide">SyllaScan AI</span>
        <button onClick={() => setOpen(false)}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-white/8 hover:bg-white/15 text-white/50 hover:text-white transition-colors">
          <X size={12} />
        </button>
      </div>

      {/* Messages */}
      <ConversationThread
        messages={assistant.messages}
        loading={assistant.loading}
        onConfirmActions={handleConfirmActions}
        onDismissActions={handleDismissActions}
      />

      {/* Input area */}
      <div className="shrink-0 mx-3 mb-3 rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(30,30,36,0.85)' }}>
        <textarea
          id="sx-expanded-input"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const t = e.currentTarget.value.trim();
              if (t && !assistant.loading) { assistant.sendMessage(t); e.currentTarget.value = ''; }
            }
          }}
          placeholder={!googleCalendarConnected ? 'Connect Google Calendar first...' : 'Ask anything...'}
          disabled={!googleCalendarConnected || assistant.loading}
          rows={1}
          className="w-full bg-transparent px-4 pt-3 pb-1 text-sm text-white/90 placeholder-white/30 outline-none resize-none leading-relaxed"
          style={{ maxHeight: '96px', fontFamily: 'inherit' }}
        />
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          <div className="flex items-center gap-0.5">
            <button onClick={() => fileRef.current?.click()}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/35 hover:text-white/70 hover:bg-white/8 transition-colors">
              <Plus size={16} />
            </button>
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={assistant.recording ? async () => { const t = await assistant.stopRecording(); if (t) assistant.sendMessage(t); } : assistant.startRecording}
              className={['w-8 h-8 flex items-center justify-center rounded-full transition-colors',
                assistant.recording ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'text-white/35 hover:text-white/70 hover:bg-white/8'].join(' ')}>
              {assistant.recording ? <Square size={13} className="fill-current" /> : <Mic size={15} />}
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('sx-expanded-input') as HTMLTextAreaElement | null;
                if (el && el.value.trim() && !assistant.loading) { assistant.sendMessage(el.value.trim()); el.value = ''; }
              }}
              disabled={assistant.loading}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/90 disabled:opacity-30 transition-all"
            >
              <ArrowUp size={15} />
            </button>
          </div>
        </div>
      </div>

      {!googleCalendarConnected && (
        <div className="px-3 pb-2.5 text-xs text-yellow-400/60 text-center">
          Connect Google Calendar to create events
        </div>
      )}
    </div>
  );
}
