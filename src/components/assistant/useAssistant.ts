'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ConversationMessage, AssistantAction } from './types';

interface UseAssistantOptions {
  userId: string | null;
  calendarEvents: Array<{ id: string; calendarId: string; title: string; start: string; end: string; allDay: boolean }>;
}

export function useAssistant({ userId, calendarEvents }: UseAssistantOptions) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!userId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('conversations')
      .select('messages')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }: { data: { messages: unknown } | null }) => {
        if (data?.messages && Array.isArray(data.messages)) {
          setMessages(data.messages as ConversationMessage[]);
        }
        setHistoryLoaded(true);
      });
  }, [userId]);

  const persistMessages = useCallback(async (msgs: ConversationMessage[]) => {
    if (!userId) return;
    // Strip base64 images before persisting — Supabase has a ~1 MB row limit.
    // Fold the image count into content so the AI retains context on reload.
    const safe = msgs.map(m => {
      if (!m.images?.length) return m;
      const note = m.content ? m.content : `(sent ${m.images.length} image${m.images.length > 1 ? 's' : ''})`;
      return { ...m, images: undefined, content: note };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('conversations')
      .upsert({ user_id: userId, messages: safe }, { onConflict: 'user_id' });
  }, [userId]);

  const sendMessage = useCallback(async (text: string, images?: string[]) => {
    const hasContent = text.trim() || (images && images.length > 0);
    if (!hasContent || loading) return;

    const userMsg: ConversationMessage = {
      role: 'user',
      content: text,
      images: images?.length ? images : undefined,
      timestamp: new Date().toISOString(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          images: images ?? [],
          // History: include image-note in content so AI has prior context without resending base64
          history: messages.slice(-20).map(m => ({
            role: m.role,
            content: m.images?.length
              ? (m.content ? `${m.content} (had ${m.images.length} image${m.images.length > 1 ? 's' : ''} attached)` : `(sent ${m.images.length} image${m.images.length > 1 ? 's' : ''})`)
              : m.content,
          })),
          calendarEvents,
          timezone: tz,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { reply: string; actions: AssistantAction[] };

      const assistantMsg: ConversationMessage = {
        role: 'assistant',
        content: data.reply,
        actions: data.actions.length > 0 ? data.actions : undefined,
        timestamp: new Date().toISOString(),
      };
      const withReply = [...next, assistantMsg];
      setMessages(withReply);
      await persistMessages(withReply);
    } catch {
      const errMsg: ConversationMessage = {
        role: 'assistant',
        content: "Sorry, I had trouble with that. Try again.",
        timestamp: new Date().toISOString(),
      };
      const withErr = [...next, errMsg];
      setMessages(withErr);
      await persistMessages(withErr);
    } finally {
      setLoading(false);
    }
  }, [messages, calendarEvents, loading, persistMessages]);

  const markConfirmed = useCallback(async (msgIndex: number) => {
    const updated = messages.map((m, i) => i === msgIndex ? { ...m, confirmed: true } : m);
    setMessages(updated);
    await persistMessages(updated);
  }, [messages, persistMessages]);

  const clearHistory = useCallback(async () => {
    setMessages([]);
    if (userId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('conversations').upsert({ user_id: userId, messages: [] }, { onConflict: 'user_id' });
    }
  }, [userId]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch { /* mic denied */ }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) { resolve(null); return; }
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        recorder.stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        if (blob.size > 25 * 1024 * 1024) { resolve(null); return; }
        const form = new FormData();
        form.append('audio', blob, 'recording.webm');
        try {
          const res = await fetch('/api/voice/transcribe', { method: 'POST', body: form });
          if (!res.ok) { resolve(null); return; }
          const { transcript } = await res.json();
          resolve(transcript ?? null);
        } catch { resolve(null); }
      };
      recorder.stop();
    });
  }, []);

  return { messages, loading, recording, historyLoaded, sendMessage, markConfirmed, clearHistory, startRecording, stopRecording };
}
