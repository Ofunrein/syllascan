'use client';
import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react';
import { usePathname } from 'next/navigation';
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

// ── Drag hook (stores offset from bottom-center/right) ───────────────
function useDrag() {
  // null = use CSS default position; {x,y} = user-dragged absolute top-left
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(POS_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (typeof p.x === 'number' && typeof p.y === 'number') {
          // Clamp to viewport on load
          const w = 440; const h = 80;
          const cx = Math.max(0, Math.min(window.innerWidth - w, p.x));
          const cy = Math.max(0, Math.min(window.innerHeight - h, p.y));
          setDragPos({ x: cx, y: cy });
        } else {
          localStorage.removeItem(POS_KEY);
        }
      }
    } catch { localStorage.removeItem(POS_KEY); }
  }, []);

  const clearDragPos = useCallback(() => {
    setDragPos(null);
    localStorage.removeItem(POS_KEY);
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
      const el = widgetRef.current;
      const w = el?.offsetWidth ?? 440;
      const h = el?.offsetHeight ?? 80;
      // Hard-clamp so widget can never leave the viewport
      const x = Math.max(8, Math.min(window.innerWidth  - w  - 8, e.clientX - offset.current.x));
      const y = Math.max(8, Math.min(window.innerHeight - h  - 8, e.clientY - offset.current.y));
      setDragPos({ x, y });
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setDragPos(p => { if (p) localStorage.setItem(POS_KEY, JSON.stringify(p)); return p; });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  return { widgetRef, dragPos, onMouseDown, clearDragPos };
}

// ── Calendar events fetcher ──────────────────────────────────────────
interface CalEvent { id: string; calendarId: string; title: string; start: string; end: string; allDay: boolean }

async function fetchAllCalendarEvents(): Promise<CalEvent[]> {
  // Fetch all user calendars first
  const calRes = await fetch('/api/calendar/calendars');
  if (!calRes.ok) return [];
  const { calendars } = await calRes.json() as { calendars: Array<{ id: string }> };
  if (!calendars?.length) return [];

  const calendarIds = calendars.map((c: { id: string }) => c.id).join(',');
  const timeMin = new Date(Date.now() - 14 * 86400000).toISOString();   // past 14 days
  const timeMax = new Date(Date.now() + 60 * 86400000).toISOString();   // next 60 days

  const q = new URLSearchParams({ calendarIds, timeMin, timeMax });
  const evRes = await fetch(`/api/calendar/events?${q}`);
  if (!evRes.ok) return [];
  const { events } = await evRes.json();
  return events ?? [];
}

// ── Image resize helper ──────────────────────────────────────────────
// Downscales to max 1024px and re-encodes as JPEG@0.82 to stay well under
// Vercel's 4.5 MB request body limit before sending to the vision API.
function resizeImageForVision(file: File, maxPx = 1024, quality = 0.82): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

// ── Main widget ──────────────────────────────────────────────────────
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [collapsedText, setCollapsedText] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalEvent[]>([]);
  const [pendingImages, setPendingImages] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const pathname = usePathname();
  const { user, googleCalendarConnected } = useAuth();
  const { widgetRef, dragPos, onMouseDown } = useDrag();
  const fileRef = useRef<HTMLInputElement>(null);
  const pasteReadyRef = useRef(false);

  // Fetch calendar events whenever the widget opens (or Google Calendar connects)
  useEffect(() => {
    if (!googleCalendarConnected) return;
    fetchAllCalendarEvents().then(setCalendarEvents).catch(() => {});
  }, [open, googleCalendarConnected]);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const assistant = useAssistant({ userId: user?.id ?? null, calendarEvents });
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
    const imgs = pendingImages.map(p => p.previewUrl);
    if (!text && imgs.length === 0) return;
    setCollapsedText('');
    setPendingImages([]);
    setOpen(true);
    setTimeout(() => assistant.sendMessage(text || 'What do you see in this image?', imgs), 50);
  }, [collapsedText, pendingImages, assistant]);

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

  // Paste / drag-drop into the assistant — bails on /upload so the upload page wins
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (pathname?.startsWith('/upload')) return;
      const focused = document.activeElement as HTMLElement | null;
      const widgetHasFocus = !!widgetRef.current?.contains(focused);
      if (!open && !widgetHasFocus && !pasteReadyRef.current) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageFiles: File[] = [];
      const docFiles: File[] = [];
      for (const it of items) {
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) {
            if (f.type.startsWith('image/')) imageFiles.push(f);
            else docFiles.push(f);
          }
        }
      }
      if (imageFiles.length === 0 && docFiles.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      // Images → resize/compress then show inline preview, don't upload yet
      if (imageFiles.length > 0) {
        setOpen(true);
        for (const f of imageFiles) {
          resizeImageForVision(f).then(compressed => {
            setPendingImages(prev => [...prev, { file: f, previewUrl: compressed }]);
          });
        }
      }
      // Non-image files → upload immediately (syllabus/doc flow)
      docFiles.forEach(handleFileSelect);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [open, pathname, handleFileSelect, widgetRef]);

  const onDragOverWidget = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const onDropWidget = (e: React.DragEvent) => {
    if (!e.dataTransfer.files?.length) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    Array.from(e.dataTransfer.files).forEach(handleFileSelect);
  };

  const handleConfirmActions = useCallback(async (msgIndex: number, actions: AssistantAction[]) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    for (const action of actions) {
      if (action.type === 'CREATE') {
        await fetch('/api/calendar/events', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendarId: action.event.calendarId ?? 'primary', event: { ...action.event, timezone: tz }, addMeet: false }) });
      } else if (action.type === 'EDIT') {
        const q = new URLSearchParams({ calendarId: action.calendarId, updateScope: 'single' });
        await fetch(`/api/calendar/events/${action.eventId}?${q}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: { ...action.changes, timezone: tz } }) });
      } else if (action.type === 'MOVE') {
        const q = new URLSearchParams({ calendarId: action.calendarId, updateScope: 'single' });
        await fetch(`/api/calendar/events/${action.eventId}?${q}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: { start: action.newStart, end: action.newEnd, timezone: tz } }) });
      } else if (action.type === 'DELETE') {
        const q = new URLSearchParams({ calendarId: action.calendarId, updateScope: 'single' });
        await fetch(`/api/calendar/events/${action.eventId}?${q}`, { method: 'DELETE' });
      }
    }
    await assistant.markConfirmed(msgIndex);
    // Refresh calendar context so AI knows about the change
    if (googleCalendarConnected) {
      fetchAllCalendarEvents().then(setCalendarEvents).catch(() => {});
    }
  }, [assistant, googleCalendarConnected]);

  const handleDismissActions = useCallback((msgIndex: number) => {
    assistant.markConfirmed(msgIndex);
  }, [assistant]);

  // Bottom-right on landing page, bottom-center everywhere else
  // Dragged position overrides default
  const isLanding = pathname === '/';
  const baseStyle: React.CSSProperties = dragPos
    ? { position: 'fixed', left: dragPos.x, top: dragPos.y }
    : isLanding
      ? { position: 'fixed', right: '24px', bottom: '24px' }
      : { position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)' };

  if (!user) return null;

  // ── Collapsed bar ────────────────────────────────────────────────────
  if (!open) {
    return (
      <div
        ref={widgetRef}
        data-syllascan-assistant
        tabIndex={-1}
        onFocus={() => { pasteReadyRef.current = true; }}
        onBlur={(e) => { if (!widgetRef.current?.contains(e.relatedTarget as Node)) pasteReadyRef.current = false; }}
        onMouseDown={onMouseDown}
        onDragOver={onDragOverWidget}
        onDrop={onDropWidget}
        style={{
          ...baseStyle,
          width: 'min(440px, 92vw)',
          background: 'rgba(18, 18, 22, 0.62)',
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
        {/* Row 1: pending image thumbnails (when images pasted before sending) */}
        {pendingImages.length > 0 && !recording && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pendingImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img src={img.previewUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-white/20" />
                <button
                  onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/80 text-white/70 hover:text-white flex items-center justify-center text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Row 2: text OR waveform */}
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
              disabled={(!collapsedText.trim() && pendingImages.length === 0) || recording}
              className={['w-8 h-8 flex items-center justify-center rounded-full transition-all',
                (collapsedText.trim() || pendingImages.length > 0) && !recording ? 'bg-white text-black hover:bg-white/90' : 'bg-white/12 text-white/25'].join(' ')}>
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
      data-syllascan-assistant
      tabIndex={-1}
      onFocus={() => { pasteReadyRef.current = true; }}
      onBlur={(e) => { if (!widgetRef.current?.contains(e.relatedTarget as Node)) pasteReadyRef.current = false; }}
      onDragOver={onDragOverWidget}
      onDrop={onDropWidget}
      style={{
        ...baseStyle,
        width: 'min(420px, 90vw)',
        height: 'min(580px, 80vh)',
        background: 'rgba(10, 10, 14, 0.76)',
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
        {/* Pending image previews */}
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
            {pendingImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img src={img.previewUrl} alt="" className="w-14 h-14 rounded-xl object-cover border border-white/15" />
                <button
                  onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/80 text-white/70 hover:text-white flex items-center justify-center text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          id="sx-expanded-input"
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 200) + 'px';
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const t = e.currentTarget.value.trim();
              const imgs = pendingImages.map(p => p.previewUrl);
              if ((t || imgs.length > 0) && !assistant.loading) {
                setPendingImages([]);
                assistant.sendMessage(t || 'What do you see in this image?', imgs);
                e.currentTarget.value = '';
              }
            }
          }}
          placeholder={!googleCalendarConnected ? 'Connect Google Calendar first...' : 'Ask anything...'}
          disabled={!googleCalendarConnected || assistant.loading}
          rows={1}
          className="w-full bg-transparent px-4 pt-3 pb-1 text-sm text-white/90 placeholder-white/30 outline-none resize-none leading-relaxed"
          style={{ minHeight: '40px', maxHeight: '200px', fontFamily: 'inherit', overflowY: 'auto' }}
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
                const t = el?.value.trim() ?? '';
                const imgs = pendingImages.map(p => p.previewUrl);
                if ((t || imgs.length > 0) && !assistant.loading) {
                  setPendingImages([]);
                  assistant.sendMessage(t || 'What do you see in this image?', imgs);
                  if (el) el.value = '';
                }
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
