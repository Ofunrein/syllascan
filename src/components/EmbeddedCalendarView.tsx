'use client';

import { useState } from 'react';
import { useUser } from '@/lib/UserContext';

export default function EmbeddedCalendarView() {
  const { user } = useUser();
  const [viewMode] = useState<'WEEK' | 'MONTH' | 'AGENDA'>('WEEK');
  const [timezone] = useState('America/Chicago');

  // Simple function to get a calendar URL that will work
  const getCalendarUrl = () => {
    return 'https://calendar.google.com/calendar/embed?' + 
      'src=primary' +
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
  };

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
          <iframe 
            src={getCalendarUrl()}
            className="absolute top-0 left-0 w-full h-full border-0"
            frameBorder="0"
            scrolling="no"
            title="Google Calendar"
          ></iframe>
        </div>
        
        <div className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
          <p>Note: This is a view-only calendar. To add events, use the event creation feature in the app.</p>
        </div>
      </div>
    </div>
  );
} 