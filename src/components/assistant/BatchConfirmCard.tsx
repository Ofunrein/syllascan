'use client';
import { useState } from 'react';
import { Check, X, Calendar, Trash2, Edit2, MoveRight } from 'lucide-react';
import type { AssistantAction } from './types';

interface Props {
  actions: AssistantAction[];
  onConfirm: (actions: AssistantAction[]) => Promise<void>;
  onDismiss: () => void;
  loading?: boolean;
}

function actionLabel(a: AssistantAction): string {
  if (a.type === 'CREATE') return a.event.title;
  if (a.type === 'EDIT') return `Edit: ${a.changes.title ?? a.eventId}`;
  if (a.type === 'MOVE') return `Move event`;
  return `Delete: ${a.title}`;
}

function actionIcon(a: AssistantAction) {
  if (a.type === 'CREATE') return <Calendar size={13} />;
  if (a.type === 'EDIT') return <Edit2 size={13} />;
  if (a.type === 'MOVE') return <MoveRight size={13} />;
  return <Trash2 size={13} className="text-red-400" />;
}

function formatDT(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

export function BatchConfirmCard({ actions, onConfirm, onDismiss, loading }: Props) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try { await onConfirm(actions); } finally { setConfirming(false); }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#1e293b] shadow-xl overflow-hidden mt-2">
      <div className="px-3 py-2 border-b border-white/10">
        <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wide">
          {actions.length} {actions.length === 1 ? 'action' : 'actions'} — confirm?
        </span>
      </div>
      <div className="divide-y divide-white/5">
        {actions.map((action, i) => (
          <div key={i} className="px-3 py-2.5 flex items-start gap-2">
            <span className="mt-0.5 text-white/40 shrink-0">{actionIcon(action)}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{actionLabel(action)}</div>
              {action.type === 'CREATE' && (
                <div className="text-xs text-white/45 mt-0.5">
                  {action.event.allDay
                    ? new Date(action.event.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    : `${formatDT(action.event.start)}`}
                  {action.event.location ? ` · ${action.event.location}` : ''}
                </div>
              )}
              {action.type === 'MOVE' && (
                <div className="text-xs text-white/45 mt-0.5">→ {formatDT(action.newStart)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 flex items-center gap-2 border-t border-white/10">
        <button
          onClick={handleConfirm}
          disabled={confirming || loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          <Check size={13} />
          {confirming ? 'Adding...' : 'Confirm All'}
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
