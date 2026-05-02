'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useSearchParams } from 'next/navigation';
import GoogleUserProfile from './GoogleUserProfile';

interface GoogleAuthWrapperProps {
  children: ReactNode;
}

export default function GoogleAuthWrapper({ children }: GoogleAuthWrapperProps) {
  const { user, authenticated, googleCalendarConnected, profile, signInWithGoogle, refreshProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [autoConnecting, setAutoConnecting] = useState(false);
  const searchParams = useSearchParams();

  const connectCalendar = useCallback(async (next = '/scan#live-calendar') => {
    setError(null);
    setAutoConnecting(true);
    try {
      const res = await fetch(`/api/google-calendar/authorize?next=${encodeURIComponent(next)}`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Could not start Google Calendar authorization.');
      }

      if (!data.url) {
        throw new Error('Google did not return an authorization URL.');
      }

      window.location.assign(data.url);
    } catch (err) {
      setAutoConnecting(false);
      setError(err instanceof Error ? err.message : 'Could not start Google Calendar authorization.');
    }
  }, []);

  // Check if we just returned from Google OAuth flow
  useEffect(() => {
    const calendarConnected = searchParams?.get('calendar_connected');
    const calendarError = searchParams?.get('calendar_error');

    if (calendarConnected === 'true') {
      refreshProfile();
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar_connected');
      window.history.replaceState({}, '', url.toString());
    }

    if (calendarError) {
      setError(`Calendar connection failed: ${decodeURIComponent(calendarError)}`);
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar_error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, refreshProfile]);

  // Auto-redirect to calendar OAuth when signed in but tokens are missing.
  // google_calendar_connected is set true on any Google sign-in (scopes always requested),
  // but the actual tokens need a separate exchange due to Supabase PKCE limitations.
  useEffect(() => {
    if (
      authenticated &&
      googleCalendarConnected &&
      profile !== null &&
      !profile.google_tokens &&
      !autoConnecting &&
      !error
    ) {
      setAutoConnecting(true);
      connectCalendar();
    }
  }, [authenticated, googleCalendarConnected, profile, autoConnecting, error, connectCalendar]);

  if (!authenticated) {
    return (
      <div className="liquid-glass rounded-2xl p-6 text-white">
        <h2 className="text-xl font-semibold mb-4">Sign in Required</h2>
        <p className="mb-4 text-white/65">Please sign in with your Google account to access calendar features.</p>
        <button
          onClick={signInWithGoogle}
          className="px-4 py-2 bg-white text-black rounded-full hover:bg-white/85 transition flex items-center"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032s2.701-6.032 6.033-6.032c1.498 0 2.866.549 3.921 1.453l2.814-2.814C17.503 2.988 15.139 2 12.545 2 7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" fill="currentColor"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="liquid-glass rounded-2xl p-6 text-white">
        <h2 className="text-xl font-semibold mb-4 text-red-400">Calendar Error</h2>
        <p className="mb-4 text-white/70">{error}</p>
        <button
          onClick={() => { setError(null); setAutoConnecting(false); }}
          className="px-4 py-2 bg-white text-black rounded-full hover:bg-white/85 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Tokens missing — auto-connecting in progress
  if (authenticated && googleCalendarConnected && profile !== null && !profile.google_tokens) {
    return (
      <div className="liquid-glass rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/80" />
          <p className="text-white/70">Connecting to Google Calendar…</p>
        </div>
      </div>
    );
  }

  // Not connected at all (e.g. email-only user)
  if (!googleCalendarConnected) {
    return (
      <div className="liquid-glass rounded-2xl p-6 text-white">
        <h2 className="text-xl font-semibold mb-4">Google Calendar Access Required</h2>
        <p className="mb-4 text-white/65">
          Signed in as {user?.email}, but calendar access hasn&apos;t been granted yet.
        </p>
        <button
          onClick={() => connectCalendar()}
          disabled={autoConnecting}
          className="px-4 py-2 bg-white text-black rounded-full hover:bg-white/85 transition flex items-center"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032s2.701-6.032 6.033-6.032c1.498 0 2.866.549 3.921 1.453l2.814-2.814C17.503 2.988 15.139 2 12.545 2 7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" fill="currentColor"/>
          </svg>
          {autoConnecting ? 'Opening Google...' : 'Connect Google Calendar'}
        </button>
      </div>
    );
  }

  return (
    <div className="text-white">
      <div className="mb-4">
        <GoogleUserProfile />
      </div>
      {children}
    </div>
  );
}
