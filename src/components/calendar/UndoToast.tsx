'use client';
import { useEffect, useState } from 'react';
import type { UndoRecord } from './types';

interface Props {
  record: UndoRecord | null;
  onUndo: (record: UndoRecord) => void;
  onDismiss: () => void;
}

export function UndoToast({ record, onUndo, onDismiss }: Props) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!record) return;
    setProgress(100);
    const total = 6000;
    const step = 50;
    const decrement = (step / total) * 100;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p <= 0) { clearInterval(interval); onDismiss(); return 0; }
        return p - decrement;
      });
    }, step);
    return () => clearInterval(interval);
  }, [record]);

  if (!record) return null;

  const label = record.action === 'create' ? 'Event created' :
                record.action === 'delete' ? 'Event deleted' : 'Event updated';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-80 shadow-2xl">
      <div className="bg-[#1e293b] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-white/80">{label}</span>
          <div className="flex items-center gap-3">
            {record.action !== 'create' && (
              <button
                onClick={() => onUndo(record)}
                className="text-sm font-semibold text-blue-400 hover:text-blue-300"
              >
                Undo
              </button>
            )}
            <button onClick={onDismiss} className="text-white/40 hover:text-white/60 text-xs">✕</button>
          </div>
        </div>
        <div
          className="h-0.5 bg-blue-500 transition-all duration-50 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
