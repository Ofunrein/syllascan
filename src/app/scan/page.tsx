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
  const { events: storedEvents, setEvents: setStoredEvents, clearEvents: clearStoredEvents, fetchEvents } = useEventStore();
  const { user, authenticated } = useAuth();

  // Load all saved events from Supabase on mount
  useEffect(() => {
    if (authenticated && user) {
      fetchEvents(user.id);
    }
  }, [authenticated, user, fetchEvents]);

  // Sync local events with store
  useEffect(() => {
    if (storedEvents.length > 0) {
      setEvents(storedEvents);
    }
  }, [storedEvents]);

  const handleEventsExtracted = (extractedEvents: Event[]) => {
    setEvents(extractedEvents);
    setStoredEvents(extractedEvents);
    setActiveTab('events');
  };

  const handleClearEvents = () => {
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
    <div className="dark min-h-screen bg-black text-white relative overflow-hidden">
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

      <main className="relative z-10 py-10 md:py-14">
        <div className="container">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
              Academic calendar intelligence
            </p>
            <h1
              className="text-white"
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                marginBottom: '0.75rem',
                letterSpacing: '-0.02em',
              }}
            >
              Scan, review, sync.
            </h1>
            <p className="mx-auto max-w-2xl text-sm md:text-base text-white/60">
              Upload a syllabus or schedule, preview the document, extract academic dates with AI, then send clean events to Google Calendar.
            </p>
          </div>

          <div className="mb-6 flex justify-center">
            <div className="liquid-glass inline-flex max-w-full flex-wrap justify-center gap-1 rounded-full p-1">
            {tabs.map(({ id, label, Icon, badge }) => (
              <button
                key={id}
                onClick={() => handleTabClick(id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
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

          <div className="liquid-glass rounded-[1.25rem] p-4 md:p-6">
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
              <EventList events={events} onClearEvents={handleClearEvents} />
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

      <footer
        className="relative z-10 mt-6 border-t border-white/5 px-6 py-8 text-center text-sm text-white/35"
      >
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
