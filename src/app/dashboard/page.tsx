'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { useUser } from '@/lib/UserContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import ApiKeyBanner from '@/components/ApiKeyBanner';

// Use dynamic import with no SSR for components that need client-only features
const DynamicProcessingHistory = dynamic(
  () => import('@/components/ProcessingHistory'),
  { ssr: false }
);

export default function Dashboard() {
  const { user, loading, authenticated } = useUser();
  const router = useRouter();
  const [calendars, setCalendars] = useState<any[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>('calendar');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Set mounted state to true when component mounts on client
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Redirect to home if not logged in
    if (!loading && !user && mounted) {
      router.push('/');
      toast.error('Please sign in to access the dashboard');
    }
  }, [user, loading, router, mounted]);

  useEffect(() => {
    const fetchCalendars = async () => {
      if (!authenticated || !mounted) return;

      setIsLoadingCalendars(true);
      try {
        // For now, just set some dummy calendars
        setCalendars([
          { id: 'primary', summary: 'Primary Calendar', backgroundColor: '#4f46e5', primary: true },
          { id: 'work', summary: 'Work Calendar', backgroundColor: '#06b6d4' },
          { id: 'personal', summary: 'Personal Calendar', backgroundColor: '#f97316' }
        ]);
      } catch (error) {
        console.error('Error fetching calendars:', error);
        toast.error('Failed to load your calendars');
      } finally {
        setIsLoadingCalendars(false);
      }
    };

    if (authenticated && mounted) {
      fetchCalendars();
    }
  }, [authenticated, mounted, user]);

  if (loading || !mounted) {
    return (
      <div className="app-wrapper">
        <Header />
        <main className="main-content">
          <div className="container">
            <div className="loading-spinner">
              <div className="spinner"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="app-wrapper">
      <Header />
      
      <main className="main-content">
        <div className="container">
          <ApiKeyBanner />
          
          <div className="dashboard-header animate-fade-in">
            <div className="welcome-card">
              <div className="welcome-avatar">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="avatar-image" />
                ) : (
                  <div className="avatar-placeholder">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
              <div className="welcome-text">
                <h1 className="dashboard-title">Welcome to your Dashboard</h1>
                <p className="dashboard-welcome">
                  Hello, {user.displayName || user.email}! Here's an overview of your calendars and processing history.
                </p>
              </div>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-panel animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="panel-header">
                <div className="panel-icon">🗓️</div>
                <div>
                  <h2 className="panel-title">Your Google Calendars</h2>
                  <p className="panel-description">
                    Calendars you have access to
                  </p>
                </div>
              </div>
              <div className="panel-content">
                {isLoadingCalendars ? (
                  <div className="loading-spinner">
                    <div className="spinner"></div>
                  </div>
                ) : calendars.length > 0 ? (
                  <ul className="calendar-list">
                    {calendars.map((calendar) => (
                      <li key={calendar.id} className="calendar-item">
                        <div className="calendar-info">
                          <div 
                            className="calendar-color" 
                            style={{ backgroundColor: calendar.backgroundColor }}
                          ></div>
                          <p className="calendar-name">{calendar.summary}</p>
                        </div>
                        {calendar.primary && (
                          <span className="primary-badge">
                            Primary
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📅</div>
                    <p className="empty-message">No calendars found</p>
                    <button
                      onClick={() => router.push('/')}
                      className="action-button"
                    >
                      Add Events to Calendar
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-panel animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="panel-header">
                <div className="panel-icon">📋</div>
                <div>
                  <h2 className="panel-title">Processing History</h2>
                  <p className="panel-description">
                    Your recent document uploads and event extractions
                  </p>
                </div>
              </div>
              <div className="panel-content">
                {mounted && <DynamicProcessingHistory />}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <style jsx>{`
        .app-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .main-content {
          flex: 1;
          padding: 2.5rem 0;
        }
        
        .dashboard-header {
          margin-bottom: 2rem;
        }
        
        .welcome-card {
          display: flex;
          align-items: center;
          background: linear-gradient(to right, var(--primary), var(--secondary));
          border-radius: var(--radius);
          padding: 2rem;
          color: white;
          box-shadow: 0 10px 25px -5px rgba(var(--primary-rgb, 79, 70, 229), 0.3);
        }
        
        .welcome-avatar {
          margin-right: 1.5rem;
          flex-shrink: 0;
        }
        
        .avatar-image {
          width: 4rem;
          height: 4rem;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid rgba(255, 255, 255, 0.8);
        }
        
        .avatar-placeholder {
          width: 4rem;
          height: 4rem;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 600;
          color: white;
          border: 3px solid rgba(255, 255, 255, 0.8);
        }
        
        .dashboard-title {
          font-size: 1.875rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: white;
        }
        
        .dashboard-welcome {
          font-size: 1rem;
          opacity: 0.9;
        }
        
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        
        .dashboard-panel {
          background-color: var(--card);
          border-radius: var(--radius);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .dashboard-panel:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        
        .panel-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
        }
        
        .panel-icon {
          font-size: 1.75rem;
          margin-right: 1rem;
          background-color: rgba(var(--primary-rgb, 79, 70, 229), 0.1);
          width: 3rem;
          height: 3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.75rem;
          color: var(--primary);
        }
        
        /* Ensure dark mode compatibility for panel icons */
        :global(.dark) .panel-icon {
          background-color: rgba(var(--primary-rgb, 79, 70, 229), 0.2);
        }
        
        .panel-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--foreground);
          margin-bottom: 0.25rem;
        }
        
        .panel-description {
          font-size: 0.875rem;
          color: var(--foreground);
          opacity: 0.7;
        }
        
        .panel-content {
          padding: 1.5rem;
        }
        
        .loading-spinner {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 8rem;
        }
        
        .spinner {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          border: 3px solid rgba(var(--primary-rgb, 79, 70, 229), 0.1);
          border-top-color: var(--primary);
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .calendar-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .calendar-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          transition: background-color 0.2s;
        }
        
        .calendar-item:hover {
          background-color: rgba(0, 0, 0, 0.02);
        }
        
        .calendar-item:last-child {
          border-bottom: none;
        }
        
        .calendar-info {
          display: flex;
          align-items: center;
        }
        
        .calendar-color {
          width: 1rem;
          height: 1rem;
          border-radius: 50%;
          margin-right: 0.75rem;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .calendar-name {
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--foreground);
        }
        
        .primary-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background-color: rgba(var(--primary-rgb, 79, 70, 229), 0.1);
          color: var(--primary);
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 9999px;
        }
        
        .empty-state {
          text-align: center;
          padding: 2rem 0;
        }
        
        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }
        
        .empty-message {
          color: var(--foreground);
          opacity: 0.7;
          margin-bottom: 1.5rem;
        }
        
        .action-button {
          display: inline-flex;
          align-items: center;
          padding: 0.625rem 1.25rem;
          background-color: var(--primary);
          color: white;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 0.375rem;
          border: none;
          cursor: pointer;
          transition: background-color 0.2s;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .action-button:hover {
          background-color: var(--primary-dark);
        }
        
        @media (max-width: 640px) {
          .welcome-card {
            flex-direction: column;
            text-align: center;
            padding: 1.5rem;
          }
          
          .welcome-avatar {
            margin-right: 0;
            margin-bottom: 1rem;
          }
          
          .dashboard-title {
            font-size: 1.5rem;
          }
          
          .dashboard-welcome {
            font-size: 0.875rem;
          }
          
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
} 