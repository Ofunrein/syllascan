'use client';
import { useEffect, useRef } from 'react';
import { BatchConfirmCard } from './BatchConfirmCard';
import type { ConversationMessage, AssistantAction } from './types';

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
            <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            {msg.actions && msg.actions.length > 0 && !msg.confirmed && (
              <BatchConfirmCard
                actions={msg.actions}
                onConfirm={(actions) => onConfirmActions(i, actions)}
                onDismiss={() => onDismissActions(i)}
              />
            )}
            {msg.confirmed && <p className="text-xs text-white/35 mt-1.5">✓ Added to calendar</p>}
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
