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

export default function ScanPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'events' | 'live-calendar' | 'embedded-calendar'>('upload');
  const [isCalendarExpired, setIsCalendarExpired] = useState(false);

  const handleEventsExtracted = (extractedEvents: Event[]) => {
    setEvents(extractedEvents);
    setActiveTab('events');
  };

  const handleClearEvents = () => {
    setEvents([]);
    setActiveTab('upload');
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'live-calendar') setActiveTab('live-calendar');
      else if (hash === 'embedded-calendar') setActiveTab('embedded-calendar');
      else if (hash === 'events' && events.length > 0) setActiveTab('events');
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

  const tabs: Array<{ id: TabId; label: string; Icon: React.ElementType; disabled?: boolean }> = [
    { id: 'upload', label: 'Upload', Icon: Upload },
    { id: 'events', label: 'Events', Icon: Calendar, disabled: events.length === 0 },
    { id: 'live-calendar', label: 'Live Calendar', Icon: CalendarCheck },
    { id: 'embedded-calendar', label: 'Embedded', Icon: LayoutGrid },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f9fafb' }}>
      {isCalendarExpired && <CalendarAuthBanner />}
      <Header />

      <main style={{ padding: '2rem 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                color: '#fff',
                marginBottom: '0.75rem',
                letterSpacing: '-0.02em',
              }}
            >
              SyllaScan
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem', maxWidth: '32rem', margin: '0 auto' }}>
              Upload your syllabus and automatically extract events to your Google Calendar
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              marginBottom: '1.5rem',
              gap: '0.25rem',
              flexWrap: 'wrap',
            }}
          >
            {tabs.map(({ id, label, Icon, disabled }) => (
              <button
                key={id}
                onClick={() => !disabled && handleTabClick(id)}
                disabled={disabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: activeTab === id ? '#fff' : 'rgba(255,255,255,0.45)',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === id ? '2px solid rgba(255,255,255,0.85)' : '2px solid transparent',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.3 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '0.875rem',
              border: '1px solid rgba(255,255,255,0.07)',
              padding: '1.5rem',
            }}
          >
            {activeTab === 'upload' && (
              <FileUploader
                onEventsExtracted={handleEventsExtracted}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
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
        style={{
          textAlign: 'center',
          padding: '2rem',
          color: 'rgba(255,255,255,0.35)',
          fontSize: '0.875rem',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          marginTop: '3rem',
        }}
      >
        {new Date().getFullYear()} SyllaScan. All rights reserved.{' '}
        <a href="/privacy-policy" style={{ color: 'rgba(255,255,255,0.45)' }}>Privacy Policy</a>
        {' | '}
        <a href="/terms-of-service" style={{ color: 'rgba(255,255,255,0.45)' }}>Terms of Service</a>
      </footer>
    </div>
  );
}
