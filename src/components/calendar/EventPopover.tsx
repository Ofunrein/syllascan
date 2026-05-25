'use client';
import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit2, Trash2, Copy, MapPin, Clock, Video } from 'lucide-react';
import type { GCalEvent } from './types';

interface Props {
  event: GCalEvent;
  position: { x: number; y: number };
  onClose: () => void;
  onEdit: (event: GCalEvent) => void;
  onDelete: (event: GCalEvent) => void;
  onDuplicate: (event: GCalEvent) => void;
}

function formatTime(iso: string, allDay: boolean) {
  if (allDay) return 'All day';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function EventPopover({ event, position, onClose, onEdit, onDelete, onDuplicate }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const startFmt = formatTime(event.start, event.allDay);
  const endFmt = formatTime(event.end, event.allDay);
  const timeLabel = event.allDay ? 'All day' : `${startFmt} – ${endFmt}`;

  const popover = (
    <div
      ref={ref}
      className="fixed z-[9999] w-72 bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      style={{ top: position.y, left: position.x }}
    >
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: event.calendarColor ?? '#3b82f6' }}
          />
          <h3 className="font-semibold text-white text-sm truncate">{event.title}</h3>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/70 ml-2 shrink-0">
          <X size={14} />
        </button>
      </div>

      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2 text-white/60 text-xs">
          <Clock size={12} />
          <span>{timeLabel}</span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-white/60 text-xs">
            <MapPin size={12} />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        {event.hangoutLink && (
          <div className="flex items-center gap-2 text-xs">
            <Video size={12} className="text-blue-400" />
            <a href={event.hangoutLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">
              Join Google Meet
            </a>
          </div>
        )}
        {event.description && (
          <p className="text-white/50 text-xs line-clamp-3">{event.description}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-1 px-3 pb-3 border-t border-white/10 pt-2">
        <button
          onClick={() => { onDuplicate(event); onClose(); }}
          className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          title="Duplicate"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={() => { onEdit(event); onClose(); }}
          className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          title="Edit"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => { onDelete(event); onClose(); }}
          className="p-1.5 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(popover, document.body);
}
