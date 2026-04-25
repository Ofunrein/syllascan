'use client';

import { useState, useRef, useEffect } from 'react';
import { PlusIcon, XMarkIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/components/AuthProvider';
import { useEventStore } from '@/lib/stores/eventStore';
import type { Event } from '@/lib/openai';

export default function QuickAdd() {
  const { user, authenticated } = useAuth();
  const { saveEvent } = useEventStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPreview(null);
        setInput('');
        setError(null);
      }
    };
    if (open) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!authenticated) return null;

  const handleParse = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const res = await fetch('/api/nlp-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      });

      const data = await res.json();

      if (data.event) {
        setPreview({
          id: '',
          ...data.event,
          source: 'manual',
        });
      } else {
        setError(data.message || 'Could not parse that into an event');
      }
    } catch {
      setError('Failed to parse. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview || !user) return;
    setLoading(true);
    try {
      await saveEvent(preview, user.id);
      setOpen(false);
      setPreview(null);
      setInput('');
    } catch {
      setError('Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (preview) {
        handleConfirm();
      } else {
        handleParse();
      }
    }
  };

  const typeColors: Record<string, string> = {
    exam: 'bg-red-500/20 text-red-300',
    assignment: 'bg-orange-500/20 text-orange-300',
    discussion: 'bg-blue-500/20 text-blue-300',
    reading: 'bg-green-500/20 text-green-300',
    class: 'bg-purple-500/20 text-purple-300',
    meeting: 'bg-cyan-500/20 text-cyan-300',
    personal: 'bg-pink-500/20 text-pink-300',
    other: 'bg-gray-500/20 text-gray-300',
  };

  return (
    <>
      {/* FAB Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500
                     text-white shadow-lg shadow-blue-600/30 flex items-center justify-center
                     transition-all hover:scale-105 active:scale-95"
          aria-label="Quick add event"
        >
          <PlusIcon className="w-7 h-7" />
        </button>
      )}

      {/* Quick Add Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)]">
          <div className="liquid-glass rounded-2xl p-4 border border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/80 text-sm font-medium">Quick Add Event</span>
              <button
                onClick={() => { setOpen(false); setPreview(null); setInput(''); setError(null); }}
                className="text-white/40 hover:text-white/80 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Input */}
            <div className="relative mb-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); setPreview(null); setError(null); }}
                onKeyDown={handleKeyDown}
                placeholder='e.g. "Midterm March 15 at 2pm in room 301"'
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                           text-white placeholder:text-white/25 focus:outline-none focus:border-white/30
                           text-sm pr-10"
                disabled={loading}
              />
              {loading && (
                <ArrowPathIcon className="w-5 h-5 text-white/40 absolute right-3 top-3.5 animate-spin" />
              )}
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-400 text-xs mb-3">{error}</p>
            )}

            {/* Preview Card */}
            {preview && (
              <div className="bg-white/5 rounded-xl p-3 mb-3 border border-white/10">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-white font-medium text-sm">{preview.title}</h4>
                  {preview.type && (
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${typeColors[preview.type] || typeColors.other}`}>
                      {preview.type}
                    </span>
                  )}
                </div>
                {preview.date && (
                  <p className="text-white/50 text-xs mb-1">
                    {preview.date}
                    {preview.startTime && ` at ${preview.startTime}`}
                    {preview.endTime && ` - ${preview.endTime}`}
                  </p>
                )}
                {preview.location && (
                  <p className="text-white/40 text-xs">{preview.location}</p>
                )}
                {preview.description && (
                  <p className="text-white/40 text-xs mt-1">{preview.description}</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {!preview ? (
                <button
                  onClick={handleParse}
                  disabled={!input.trim() || loading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500
                             text-white text-sm font-medium transition-colors disabled:opacity-40"
                >
                  {loading ? 'Parsing...' : 'Parse Event'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setPreview(null); inputRef.current?.focus(); }}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10
                               text-white/60 text-sm transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                               bg-green-600 hover:bg-green-500 text-white text-sm font-medium
                               transition-colors disabled:opacity-40"
                  >
                    <CheckIcon className="w-4 h-4" />
                    {loading ? 'Saving...' : 'Add Event'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
