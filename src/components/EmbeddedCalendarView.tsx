'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/lib/UserContext';

export default function EmbeddedCalendarView() {
  const { user } = useUser();
  const [viewMode] = useState<'WEEK' | 'MONTH' | 'AGENDA'>('WEEK');
  const [timezone] = useState('America/Chicago');
  const [calendarUrl, setCalendarUrl] = useState('');

  // Update the calendar URL when user changes
  useEffect(() => {
    if (user && user.email) {
      // Create a calendar URL that includes the user's email to show their events
      const url = 'https://calendar.google.com/calendar/embed?' + 
        `src=${encodeURIComponent(user.email)}` +
        `&ctz=${timezone}` +
        `&mode=${viewMode.toLowerCase()}` +
        '&showTitle=0' +
        '&showNav=1' +
        '&showDate=1' +
        '&showPrint=0' +
        '&showTabs=1' +
        '&showCalendars=0' +
        '&showTz=1' +
        '&height=600' +
        '&wkst=1';
      setCalendarUrl(url);
    }
  }, [user, viewMode, timezone]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Embedded Calendar View
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            This is an embedded view of your Google Calendar
          </p>
        </div>
        
        <div className="relative pb-[75%] h-0 overflow-hidden">
          {user && calendarUrl ? (
            <iframe 
              src={calendarUrl}
              className="absolute top-0 left-0 w-full h-full border-0"
              frameBorder="0"
              scrolling="no"
              title="Google Calendar"
            ></iframe>
          ) : (
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
              <p className="text-gray-500 dark:text-gray-400">Please sign in to view your calendar</p>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
          <p>Note: This is a view-only calendar. To add events, use the event creation feature in the app.</p>
        </div>
      </div>
    </div>
  );
} 