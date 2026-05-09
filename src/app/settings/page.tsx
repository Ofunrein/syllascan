'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useAuth } from '@/components/AuthProvider';

export default function SettingsPage() {
  const { user, profile, loading, authenticated, googleCalendarConnected, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [usage, setUsage] = useState<{ extraction_count: number; chat_count: number } | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!loading && !user && mounted) router.push('/');
  }, [user, loading, router, mounted]);

  useEffect(() => {
    async function loadUsage() {
      if (!user) return;

      try {
        setUsageLoading(true);
        const res = await fetch('/api/settings/usage', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load usage');
        const data = await res.json();
        setUsage(data);
      } catch (error) {
        console.error('Failed to load usage:', error);
        setUsage({ extraction_count: 0, chat_count: 0 });
      } finally {
        setUsageLoading(false);
      }
    }

    if (mounted && user) {
      loadUsage();
    }
  }, [mounted, user]);

  if (loading || !mounted || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
        <Header />
        <main style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </main>
      </div>
    );
  }

  const handleConnectCalendar = async () => {
    try {
      const res = await fetch(`/api/google-calendar/authorize?next=${encodeURIComponent('/settings')}`);
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      console.error('Failed to connect calendar:', e);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f9fafb' }}>
      <Header />
      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '2rem' }}>Settings</h1>

        {/* Profile Section */}
        <div className="liquid-glass rounded-2xl p-6 mb-4">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profile</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: '3rem', height: '3rem', borderRadius: '50%' }} referrerPolicy="no-referrer" />
            ) : (
              <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 600 }}>
                {(profile?.display_name || user.email)?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p style={{ fontWeight: 500 }}>{profile?.display_name || 'No name set'}</p>
              <p style={{ fontSize: '0.875rem', opacity: 0.5 }}>{user.email}</p>
            </div>
          </div>
        </div>

        {/* Google Calendar Section */}
        <div className="liquid-glass rounded-2xl p-6 mb-4">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Google Calendar</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontWeight: 500 }}>{googleCalendarConnected ? 'Connected' : 'Not connected'}</p>
              <p style={{ fontSize: '0.875rem', opacity: 0.5 }}>
                {googleCalendarConnected ? 'Your events sync to Google Calendar' : 'Connect to sync events to your calendar'}
              </p>
            </div>
            {googleCalendarConnected ? (
              <span style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(22,163,74,0.2)', color: '#4ade80' }}>Connected</span>
            ) : (
              <button onClick={handleConnectCalendar} style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', borderRadius: '0.75rem', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}>
                Connect
              </button>
            )}
          </div>
        </div>

        {/* Preferences Section */}
        <div className="liquid-glass rounded-2xl p-6 mb-4">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preferences</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 500 }}>Auto-sync to Google Calendar</p>
                <p style={{ fontSize: '0.875rem', opacity: 0.5 }}>Automatically push new events to Google Calendar</p>
              </div>
              <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>Coming soon</span>
            </div>
          </div>
        </div>

        {/* AI Usage Section */}
        <div className="liquid-glass rounded-2xl p-6 mb-4">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Usage</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <p style={{ fontWeight: 500 }}>OpenAI access is included</p>
              <p style={{ fontSize: '0.875rem', opacity: 0.5 }}>
                SyllaScan uses the app&apos;s configured OpenAI key from the deployment environment. You do not need to manage your own API key in settings.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: '0.75rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Extractions today</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>{usageLoading ? '—' : usage?.extraction_count ?? 0}</p>
              </div>
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: '0.75rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>AI edits today</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>{usageLoading ? '—' : usage?.chat_count ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="liquid-glass rounded-2xl p-6">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</h2>
          <button
            onClick={async () => { await signOut(); router.push('/'); }}
            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', borderRadius: '0.75rem', background: 'rgba(220,38,38,0.15)', color: '#f87171', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
