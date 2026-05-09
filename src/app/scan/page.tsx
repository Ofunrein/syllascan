'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import FileUploader from '@/components/FileUploader';
import EventList from '@/components/EventList';
import { Event } from '@/lib/openai';
import LiveCalendarView from '@/components/LiveCalendarView';
import GoogleAuthWrapper from '@/components/GoogleAuthWrapper';
import EmbeddedCalendarView from '@/components/EmbeddedCalendarView';
import CalendarAuthBanner from '@/components/CalendarAuthBanner';
import { Upload, Calendar, CalendarCheck, LayoutGrid } from 'lucide-react';
import { useEventStore } from '@/lib/stores/eventStore';
import { useAuth } from '@/components/AuthProvider';
import AuthForm from '@/components/AuthForm';

export default function ScanPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'events' | 'live-calendar' | 'embedded-calendar'>('upload');
  const [isCalendarExpired, setIsCalendarExpired] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const { events: storedEvents, setEvents: setStoredEvents, clearEvents: clearStoredEvents, fetchEvents, saveEvents, removeEvent } = useEventStore();
  const { user, authenticated } = useAuth();

  // Load all saved events from Supabase on mount
  useEffect(() => {
    if (authenticated && user) {
      fetchEvents(user.id);
    }
  }, [authenticated, user, fetchEvents]);

  // Sync local events with store
  useEffect(() => {
    const reviewEvents = storedEvents.filter(event => !event.google_event_id);
    if (reviewEvents.length > 0) {
      setEvents(reviewEvents);
      const hash = window.location.hash.replace('#', '');
      if (!hash || hash === 'upload' || hash === 'events') {
        setActiveTab('events');
      }
    }
  }, [storedEvents]);

  const eventKey = (event: Event) => [
    (event.title || '').trim().toLowerCase(),
    event.date || event.startDate || '',
    event.startTime || '',
  ].join('|');

  const mergeEvents = (baseEvents: Event[], incomingEvents: Event[]) => {
    const merged = [...baseEvents];
    const existingKeys = new Set(merged.map(eventKey));
    const newEvents: Event[] = [];

    for (const event of incomingEvents) {
      const keyed = eventKey(event);
      if (!existingKeys.has(keyed)) {
        merged.push(event);
        newEvents.push(event);
        existingKeys.add(keyed);
      }
    }

    return { mergedEvents: merged, newEvents };
  };

  const handleEventsExtracted = async (extractedEvents: Event[]) => {
    const normalizedExtracted = extractedEvents.map(event => ({
      ...event,
      source: 'extraction',
    }));
    const { mergedEvents, newEvents } = mergeEvents(events, normalizedExtracted);
    setEvents(mergedEvents);
    setStoredEvents(mergedEvents);
    if (user && newEvents.length > 0) {
      await saveEvents(newEvents, user.id);
    }
    setActiveTab('events');
  };

  const handleEventsChange = (updatedEvents: Event[]) => {
    setEvents(updatedEvents);
    setStoredEvents(updatedEvents);
  };

  const handleClearEvents = async (deleteFromDatabase = true) => {
    if (deleteFromDatabase && user) {
      await Promise.all(
        events
          .filter(event => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.id))
          .map(event => removeEvent(event.id, user.id))
      );
    }
    setEvents([]);
    clearStoredEvents();
    setActiveTab('upload');
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'live-calendar') setActiveTab('live-calendar');
      else if (hash === 'embedded-calendar') setActiveTab('embedded-calendar');
      else if (hash === 'events') setActiveTab('events');
      else if (hash === 'upload') setActiveTab('upload');
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [events]);

  const handleTabClick = (tab: 'upload' | 'events' | 'live-calendar' | 'embedded-calendar') => {
    setActiveTab(tab);
    window.history.pushState(null, '', `#${tab}`);
  };

  type TabId = 'upload' | 'events' | 'live-calendar' | 'embedded-calendar';

  const tabs: Array<{ id: TabId; label: string; Icon: React.ElementType; badge?: number }> = [
    { id: 'upload', label: 'Upload', Icon: Upload },
    { id: 'events', label: 'Events', Icon: Calendar, badge: Math.max(events.length, storedEvents.length) || undefined },
    { id: 'live-calendar', label: 'Live Calendar', Icon: CalendarCheck },
    { id: 'embedded-calendar', label: 'Embedded', Icon: LayoutGrid },
  ];

  return (
    <div className="dark min-h-screen bg-black text-white relative overflow-hidden flex flex-col">
      <div className="pointer-events-none absolute inset-0 opacity-25">
        <video
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover translate-y-[17%]"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-black/70" />
      {isCalendarExpired && <CalendarAuthBanner />}
      <div className="relative z-50">
        <Header />
      </div>

      <main className="relative z-10 flex-1 overflow-hidden py-4 md:py-6">
        <div className="container flex h-full min-h-0 flex-col">
          <div className="mb-5 text-center md:mb-6">
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/45 md:text-xs">
              Academic calendar intelligence
            </p>
            <h1
              className="text-white"
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 'clamp(1.8rem, 4.2vw, 3.15rem)',
                marginBottom: '0.55rem',
                letterSpacing: '-0.02em',
              }}
            >
              Scan, review, sync.
            </h1>
            <p className="mx-auto max-w-2xl text-sm md:text-base text-white/60">
              Upload a syllabus or schedule, preview the document, extract academic dates with AI, then send clean events to Google Calendar.
            </p>
          </div>

          <div className="mb-4 flex justify-center md:mb-5">
            <div className="max-w-full overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="liquid-glass inline-flex min-w-max flex-nowrap justify-center gap-1 rounded-full p-1">
            {tabs.map(({ id, label, Icon, badge }) => (
              <button
                key={id}
                onClick={() => handleTabClick(id)}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  activeTab === id
                    ? 'bg-white text-black'
                    : 'text-white/55 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
                {badge ? (
                  <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold ${activeTab === id ? 'bg-black/15 text-black' : 'bg-white/15 text-white'}`}>
                    {badge}
                  </span>
                ) : null}
              </button>
            ))}
            </div>
            </div>
          </div>

          <div className="liquid-glass min-h-0 flex-1 overflow-hidden rounded-[1.25rem] p-3 md:p-5">
            {activeTab === 'upload' && (
              <FileUploader
                onEventsExtracted={handleEventsExtracted}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
                onRequireAuth={() => setShowAuth(true)}
                externalFiles={pendingFiles}
                setExternalFiles={setPendingFiles}
              />
            )}
            {activeTab === 'events' && (
              <EventList events={events} onClearEvents={handleClearEvents} onEventsChange={handleEventsChange} />
            )}
            {activeTab === 'live-calendar' && (
              <GoogleAuthWrapper>
                <LiveCalendarView />
              </GoogleAuthWrapper>
            )}
            {activeTab === 'embedded-calendar' && (
              <GoogleAuthWrapper>
                <EmbeddedCalendarView />
              </GoogleAuthWrapper>
            )}
          </div>
        </div>
      </main>

      <footer className="relative z-10 mt-auto border-t border-white/5 px-6 py-4 text-center text-sm text-white/35">
        <a href="/" className="text-white/50 hover:text-white transition-colors mr-4">← Home</a>
        {new Date().getFullYear()} SyllaScan.{' '}
        <a href="/privacy-policy" className="text-white/45 hover:text-white">Privacy Policy</a>
        {' | '}
        <a href="/terms-of-service" className="text-white/45 hover:text-white">Terms of Service</a>
      </footer>

      {showAuth && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setShowAuth(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <AuthForm onClose={() => setShowAuth(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
