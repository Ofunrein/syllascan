'use client';
import { useState, useRef, type KeyboardEvent } from 'react';
import { Plus, Mic, MicOff, Send } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  onFileSelect: (file: File) => void;
  onRecordStart: () => void;
  onRecordStop: () => Promise<string | null>;
  recording: boolean;
  loading: boolean;
  disabled?: boolean;
}

export function InputBar({ onSend, onFileSelect, onRecordStart, onRecordStop, recording, loading, disabled }: Props) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setText('');
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleMic = async () => {
    if (recording) {
      const transcript = await onRecordStop();
      if (transcript) onSend(transcript);
    } else {
      onRecordStart();
    }
  };

  return (
    <div className="px-3 py-2.5 border-t border-white/10">
      <div className="flex items-end gap-2">
        <button onClick={() => fileRef.current?.click()} disabled={disabled || loading}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0" title="Upload file">
          <Plus size={17} />
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
          className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = ''; }} />
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={recording ? 'Listening...' : 'Ask anything...'}
          disabled={disabled || recording || loading}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-white placeholder-white/30 max-h-24 overflow-y-auto leading-relaxed"
          style={{ minHeight: '24px' }}
        />
        <button onClick={handleMic} disabled={disabled || loading}
          className={['p-1.5 rounded-lg shrink-0 transition-colors', recording ? 'text-red-400 bg-red-400/15' : 'text-white/40 hover:text-white hover:bg-white/10'].join(' ')}>
          {recording ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
        <button onClick={handleSend} disabled={!text.trim() || loading || disabled || recording}
          className="p-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 transition-colors shrink-0">
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
