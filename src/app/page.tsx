'use client';

import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/Header';
import FileUploader from '@/components/FileUploader';
import EventList from '@/components/EventList';
import { Event } from '@/lib/openai';
import LiveCalendarView from '@/components/LiveCalendarView';
import GoogleAuthWrapper from '@/components/GoogleAuthWrapper';
import EmbeddedCalendarView from '@/components/EmbeddedCalendarView';
import CalendarAuthBanner from '@/components/CalendarAuthBanner';

export default function Home() {
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

  // Listen for URL hash changes to update the active tab
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'live-calendar') {
        setActiveTab('live-calendar');
      } else if (hash === 'embedded-calendar') {
        setActiveTab('embedded-calendar');
      } else if (hash === 'events' && events.length > 0) {
        setActiveTab('events');
      } else if (hash === 'upload') {
        setActiveTab('upload');
      }
    };

    // Check hash on initial load
    handleHashChange();

    // Add event listener for hash changes
    window.addEventListener('hashchange', handleHashChange);
    
    // Clean up the event listener
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [events]);

  useEffect(() => {
    const checkCalendarAuth = () => {
      const unauthorizedError = document.querySelector('.text-red-500')?.textContent?.includes('Unauthorized');
      const expiredText = document.body.textContent?.includes('Google Calendar authorization expired');
      
      if (unauthorizedError || expiredText) {
        setIsCalendarExpired(true);
      }
    };
    
    const timeoutId = setTimeout(checkCalendarAuth, 1000);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Function to handle tab click and update URL hash
  const handleTabClick = (tab: 'upload' | 'events' | 'live-calendar' | 'embedded-calendar') => {
    setActiveTab(tab);
    // Update URL hash without causing page reload
    window.history.pushState(null, '', `#${tab}`);
  };

  return (
    <div className="app-wrapper">
      {isCalendarExpired && <CalendarAuthBanner />}
      
      <Header />
      
      <main className="main-content">
        <div className="container">
          <div className="header-section animate-fade-in">
            <div className="logo-badge">
              <span className="logo-icon">📅</span>
            </div>
            <h1 className="app-title">SyllaScan</h1>
            <p className="app-description">
              Upload your syllabus or document and automatically add events to your Google Calendar
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="tabs-container">
            <button
              onClick={() => handleTabClick('upload')}
              className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
              aria-label="Upload"
            >
              <div className="tab-content">
                <div className="tab-icon-container">
                  <svg xmlns="http://www.w3.org/2000/svg" className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <span>Upload</span>
              </div>
            </button>
            
            <button
              onClick={() => handleTabClick('events')}
              className={`tab ${activeTab === 'events' ? 'active' : ''}`}
              disabled={events.length === 0}
              aria-label="Events"
            >
              <div className="tab-content">
                <div className="tab-icon-container">
                  <svg xmlns="http://www.w3.org/2000/svg" className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <path d="M8 14h.01" />
                    <path d="M12 14h.01" />
                    <path d="M16 14h.01" />
                    <path d="M8 18h.01" />
                    <path d="M12 18h.01" />
                    <path d="M16 18h.01" />
                  </svg>
                </div>
                <span>Events</span>
              </div>
            </button>
            
            <button
              onClick={() => handleTabClick('live-calendar')}
              className={`tab ${activeTab === 'live-calendar' ? 'active' : ''}`}
              aria-label="Live Calendar"
            >
              <div className="tab-content">
                <div className="tab-icon-container">
                  <svg xmlns="http://www.w3.org/2000/svg" className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <span>Live Calendar</span>
              </div>
            </button>
            
            <button
              onClick={() => handleTabClick('embedded-calendar')}
              className={`tab ${activeTab === 'embedded-calendar' ? 'active' : ''}`}
              aria-label="Embedded Calendar"
            >
              <div className="tab-content">
                <div className="tab-icon-container">
                  <svg xmlns="http://www.w3.org/2000/svg" className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <rect x="6" y="14" width="12" height="5" rx="1" />
                  </svg>
                </div>
                <span>Embedded Calendar</span>
              </div>
            </button>
          </div>

          {/* Tab Content */}
          <div className="content-panel animate-slide-up">
            {activeTab === 'upload' && (
              <FileUploader 
                onEventsExtracted={handleEventsExtracted} 
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
              />
            )}
            
            {activeTab === 'events' && (
              <EventList 
                events={events} 
                onClearEvents={handleClearEvents} 
              />
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

      <footer className="app-footer">
        <div className="container">
          <p className="footer-text">
            &copy; {new Date().getFullYear()} SyllaScan. All rights reserved. Built by Martin
            {' | '}
            <a href="/privacy-policy" className="footer-link hover:underline">Privacy Policy</a>
            {' | '}
            <a href="/terms-of-service" className="footer-link hover:underline">Terms of Service</a>
          </p>
        </div>
      </footer>
      
      <style jsx>{`
        .app-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .main-content {
          flex: 1;
          padding: 2rem 0;
        }
        
        .header-section {
          text-align: center;
          margin-bottom: 2.5rem;
        }
        
        .logo-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 5rem;
          height: 5rem;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          margin-bottom: 1.5rem;
          box-shadow: 0 10px 25px -5px rgba(var(--primary-rgb, 79, 70, 229), 0.5);
        }
        
        .logo-icon {
          font-size: 2.5rem;
        }
        
        .app-title {
          font-size: 3rem;
          font-weight: 900;
          background: linear-gradient(to right, var(--primary), var(--secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 1rem;
          letter-spacing: -0.025em;
          font-family: 'Montserrat', 'Arial', sans-serif;
          text-transform: none;
        }
        
        .app-description {
          font-size: 1.25rem;
          color: var(--foreground);
          opacity: 0.9;
          max-width: 36rem;
          margin: 0 auto;
          font-weight: 500;
          font-family: 'Inter', 'Helvetica', sans-serif;
        }
        
        .tabs-container {
          display: flex;
          justify-content: center;
          border-bottom: 1px solid var(--border);
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 0.5rem;
          padding: 0 0.5rem;
        }
        
        .tab {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--foreground);
          opacity: 0.7;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        
        .tab-content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .tab-icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 0.375rem;
          background-color: rgba(var(--primary-rgb), 0.1);
          transition: all 0.2s ease;
        }
        
        .tab-icon {
          width: 1.25rem;
          height: 1.25rem;
          color: var(--primary);
        }
        
        .tab:hover:not(:disabled) {
          opacity: 0.9;
        }
        
        .tab:hover:not(:disabled) .tab-icon-container {
          background-color: rgba(var(--primary-rgb), 0.2);
        }
        
        .tab.active {
          color: var(--primary);
          opacity: 1;
          border-bottom-color: var(--primary);
        }
        
        .tab.active .tab-icon-container {
          background-color: var(--primary);
        }
        
        .tab.active .tab-icon {
          color: white;
        }
        
        .tab:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        
        .content-panel {
          background-color: var(--card);
          border-radius: var(--radius);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          padding: 1.5rem;
        }
        
        .app-footer {
          background-color: var(--card);
          padding: 2rem 0;
          margin-top: 3rem;
          border-top: 1px solid var(--border);
        }
        
        .footer-text {
          text-align: center;
          color: var(--foreground);
          opacity: 0.6;
          font-size: 0.875rem;
        }
        
        .footer-link {
          color: var(--primary);
          font-weight: 500;
        }
        
        /* For dark mode */
        :global(.dark) .footer-link {
          color: var(--primary-light);
          opacity: 0.9;
        }
        
        @media (max-width: 640px) {
          .app-title {
            font-size: 2.25rem;
          }
          
          .app-description {
            font-size: 1rem;
          }
          
          .tabs-container {
            overflow-x: auto;
            justify-content: flex-start;
            padding-bottom: 0.5rem;
          }
          
          .tab {
            padding: 0.5rem 0.75rem;
            font-size: 0.75rem;
          }
          
          .tab-icon {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
