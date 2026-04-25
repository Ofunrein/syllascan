'use client';

import { useMemo } from 'react';
import { useEventStore } from '@/lib/stores/eventStore';
import type { Event } from '@/lib/openai';

const TYPE_WEIGHTS: Record<string, number> = {
  exam: 5, assignment: 4, quiz: 3, discussion: 2,
  class: 1, meeting: 2, personal: 1, other: 1,
};

function getUrgencyScore(event: Event): number {
  const date = event.date || event.startDate?.split('T')[0];
  if (!date) return 0;

  const eventDate = new Date(date + 'T23:59:59');
  const now = new Date();
  const diffMs = eventDate.getTime() - now.getTime();

  if (diffMs < 0) return -1; // past event

  const daysRemaining = diffMs / (1000 * 60 * 60 * 24);
  const weight = TYPE_WEIGHTS[event.type || 'other'] || 1;
  let score = weight * (1 / Math.max(daysRemaining, 0.1));

  if (daysRemaining < 2) score *= 2; // 48-hour boost

  return score;
}

function getCountdown(event: Event): string {
  const date = event.date || event.startDate?.split('T')[0];
  if (!date) return '';

  const eventDate = new Date(date + 'T23:59:59');
  const now = new Date();
  const diffMs = eventDate.getTime() - now.getTime();

  if (diffMs < 0) return 'Past';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (hours < 24) return `${hours}h left`;
  if (days < 7) return `${days}d left`;
  if (weeks < 4) return `${weeks}w left`;
  return `${days}d left`;
}

function getUrgencyColor(event: Event): string {
  const date = event.date || event.startDate?.split('T')[0];
  if (!date) return 'text-white/40';

  if (event.category === 'personal' || event.category === 'work') return 'text-white/50';

  const eventDate = new Date(date + 'T23:59:59');
  const now = new Date();
  const days = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (days < 2) return 'text-red-400';
  if (days < 7) return 'text-orange-400';
  if (days < 14) return 'text-yellow-400';
  return 'text-green-400';
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  exam: 'bg-red-500/20 text-red-300 border-red-500/30',
  assignment: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  discussion: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  reading: 'bg-green-500/20 text-green-300 border-green-500/30',
  class: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  meeting: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  personal: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  other: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

export default function UrgencyWidget() {
  const { events, loading } = useEventStore();

  const urgentEvents = useMemo(() => {
    return events
      .map(event => ({ event, score: getUrgencyScore(event) }))
      .filter(({ score }) => score > 0) // remove past events
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ event }) => event);
  }, [events]);

  if (loading) {
    return (
      <div className="liquid-glass rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4">Upcoming Deadlines</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (urgentEvents.length === 0) {
    return (
      <div className="liquid-glass rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4">Upcoming Deadlines</h3>
        <p className="text-white/40 text-sm">No upcoming events. Upload a syllabus or add events to get started.</p>
      </div>
    );
  }

  return (
    <div className="liquid-glass rounded-2xl p-6">
      <h3 className="text-white font-semibold mb-4">Upcoming Deadlines</h3>
      <div className="space-y-2">
        {urgentEvents.map((event) => {
          const countdown = getCountdown(event);
          const urgencyColor = getUrgencyColor(event);
          const badgeColor = TYPE_BADGE_COLORS[event.type || 'other'] || TYPE_BADGE_COLORS.other;

          return (
            <div
              key={event.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-white text-sm font-medium truncate">{event.title}</span>
                  {event.type && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${badgeColor}`}>
                      {event.type}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  {event.date && <span>{event.date}</span>}
                  {event.startTime && <span>at {event.startTime}</span>}
                  {event.location && <span>• {event.location}</span>}
                </div>
              </div>
              <span className={`text-sm font-medium shrink-0 ${urgencyColor}`}>
                {countdown}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
