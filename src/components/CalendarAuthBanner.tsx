'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function CalendarAuthBanner() {
  const { googleCalendarConnected } = useAuth();
  const [loading, setLoading] = useState(false);

  if (googleCalendarConnected) return null;

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/google-calendar/authorize');
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50
                    liquid-glass rounded-xl p-4 flex items-center gap-3 border border-yellow-500/30">
      <ExclamationTriangleIcon className="w-6 h-6 text-yellow-400 shrink-0" />
      <div className="flex-1">
        <p className="text-white text-sm font-medium">Google Calendar not connected</p>
        <p className="text-white/50 text-xs">Connect to sync your events</p>
      </div>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm
                   font-medium transition-colors disabled:opacity-50 shrink-0"
      >
        {loading ? 'Connecting...' : 'Connect'}
      </button>
    </div>
  );
}
