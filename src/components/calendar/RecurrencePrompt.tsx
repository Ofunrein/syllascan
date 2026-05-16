'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { UpdateScope } from './types';

interface Props {
  action: 'edit' | 'delete';
  onSelect: (scope: UpdateScope) => void;
  onCancel: () => void;
}

export function RecurrencePrompt({ action, onSelect, onCancel }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] rounded-2xl shadow-2xl p-6 w-80 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-1">
          {action === 'edit' ? 'Edit recurring event' : 'Delete recurring event'}
        </h2>
        <p className="text-sm text-white/50 mb-5">Choose which events to {action}:</p>
        <div className="space-y-2">
          {(['single', 'following', 'all'] as UpdateScope[]).map(scope => (
            <button
              key={scope}
              onClick={() => onSelect(scope)}
              className="w-full text-left px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-sm transition-colors"
            >
              {scope === 'single' && 'This event'}
              {scope === 'following' && 'This and following events'}
              {scope === 'all' && 'All events'}
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="w-full mt-4 text-center text-sm text-white/40 hover:text-white/60"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
