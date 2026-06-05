'use client';
import { useEffect, useRef } from 'react';
import { Check, Calendar, Trash2, Edit2, MoveRight, Clock, MapPin, Repeat } from 'lucide-react';
import { BatchConfirmCard } from './BatchConfirmCard';
import type { ConversationMessage, AssistantAction } from './types';

const DAY_NAMES: Record<string, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };

function describeRecurrence(rrule: string): string {
  const parts = Object.fromEntries(
    rrule.replace(/^RRULE:/, '').split(';').map(p => p.split('=') as [string, string])
  );
  const freq = parts['FREQ']?.toLowerCase();
  const days = parts['BYDAY']?.split(',').map(d => DAY_NAMES[d] ?? d).join(',');
  const until = parts['UNTIL'];
  let untilStr = '';
  if (until) {
    const m = until.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m) {
      const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
      untilStr = ` until ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
    }
  }
  if (freq === 'weekly') return `Repeats ${days ? days + ' ' : ''}weekly${untilStr}`;
  if (freq === 'daily') return `Repeats daily${untilStr}`;
  if (freq === 'monthly') return `Repeats monthly${untilStr}`;
  return `Repeats${untilStr}`;
}

function confirmedLabel(actions: AssistantAction[]): string {
  const types = [...new Set(actions.map(a => a.type))];
  if (types.length === 1) {
    switch (types[0]) {
      case 'CREATE': return 'Added to calendar';
      case 'DELETE': return 'Removed from calendar';
      case 'EDIT':   return 'Updated';
      case 'MOVE':   return 'Moved';
    }
  }
  const labels = types.map(t => t === 'CREATE' ? 'added' : t === 'DELETE' ? 'removed' : t === 'EDIT' ? 'updated' : 'moved');
  return labels.join(', ').replace(/,([^,]*)$/, ' &$1');
}

function formatDT(iso: string, allDay?: boolean): string {
  const d = new Date(iso);
  if (allDay) return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function actionTitle(a: AssistantAction): string {
  if (a.type === 'CREATE') return a.event.title;
  if (a.type === 'EDIT') return a.changes.title ?? 'Edited event';
  if (a.type === 'MOVE') return 'Moved event';
  return a.title;
}

function actionIcon(a: AssistantAction) {
  if (a.type === 'CREATE') return <Calendar size={12} className="text-blue-400" />;
  if (a.type === 'EDIT') return <Edit2 size={12} className="text-blue-400" />;
  if (a.type === 'MOVE') return <MoveRight size={12} className="text-blue-400" />;
  return <Trash2 size={12} className="text-red-400" />;
}

function ConfirmedCards({ actions }: { actions: AssistantAction[] }) {
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-emerald-400/90 font-medium">
        <Check size={12} />
        <span>{confirmedLabel(actions)}</span>
      </div>
      {actions.map((a, i) => {
        const title = actionTitle(a);
        let when: string | null = null;
        let location: string | undefined;
        let recurrence: string | undefined;
        if (a.type === 'CREATE') {
          when = formatDT(a.event.start, a.event.allDay);
          location = a.event.location;
          recurrence = a.event.recurrence;
        } else if (a.type === 'MOVE') {
          when = formatDT(a.newStart);
        }
        return (
          <div key={i} className="rounded-xl border border-white/10 bg-[#1e293b] px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2">
              {actionIcon(a)}
              <span className="text-sm font-semibold text-white truncate">{title}</span>
            </div>
            {when && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/55 mt-1">
                <Clock size={10} />
                <span>{when}</span>
              </div>
            )}
            {recurrence && (
              <div className="flex items-center gap-1.5 text-[11px] text-blue-300/80 mt-0.5">
                <Repeat size={10} />
                <span>{describeRecurrence(recurrence)}</span>
              </div>
            )}
            {location && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/55 mt-0.5">
                <MapPin size={10} />
                <span className="truncate">{location}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  messages: ConversationMessage[];
  loading: boolean;
  onConfirmActions: (msgIndex: number, actions: AssistantAction[]) => Promise<void>;
  onDismissActions: (msgIndex: number) => void;
}

export function ConversationThread({ messages, loading, onConfirmActions, onDismissActions }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/30 text-sm px-4 text-center leading-relaxed">
        Say or type anything —<br />&quot;Meeting with Hugo tomorrow 6pm&quot;<br />or drop a file
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={['max-w-[88%] rounded-2xl px-3 py-2 text-sm',
            msg.role === 'user'
              ? 'bg-blue-500 text-white rounded-br-sm'
              : 'bg-white/8 text-white/90 rounded-bl-sm border border-white/10'].join(' ')}>
            {msg.images && msg.images.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {msg.images.map((src, ii) => (
                  <img key={ii} src={src} alt="" className="rounded-lg max-w-[160px] max-h-[120px] object-cover" />
                ))}
              </div>
            )}
            {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
            {msg.actions && msg.actions.length > 0 && !msg.confirmed && (
              <BatchConfirmCard
                actions={msg.actions}
                onConfirm={(actions) => onConfirmActions(i, actions)}
                onDismiss={() => onDismissActions(i)}
              />
            )}
            {msg.confirmed && msg.actions && (
              <ConfirmedCards actions={msg.actions} />
            )}
          </div>
        </div>
      ))}
      {loading && (
        <div className="flex justify-start">
          <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
            <div className="flex gap-1 items-center">
              {[0, 150, 300].map(d => (
                <span key={d} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
