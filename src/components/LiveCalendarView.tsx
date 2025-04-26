'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/lib/UserContext';
import { Calendar, momentLocalizer, View, NavigateAction } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import toast from 'react-hot-toast';

// Set up the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

// Define event type
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  htmlLink?: string;
}

export default function LiveCalendarView() {
  const { googleAuthenticated } = useUser();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiDisabled, setApiDisabled] = useState(false);
  const [currentView, setCurrentView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeRange, setTimeRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    end: new Date(new Date().setMonth(new Date().getMonth() + 2))
  });

  const calendarRef = useRef(null);

  // Function to fetch events from Google Calendar API
  const fetchGoogleCalendarEvents = async () => {
    setIsLoading(true);
    setError(null);
    setApiDisabled(false);
    
    try {
      // Build query parameters for time range
      const params = new URLSearchParams({
        timeMin: timeRange.start.toISOString(),
        timeMax: timeRange.end.toISOString(),
        calendarId: 'primary'
      });
      
      // Fetch events from our API endpoint
      const response = await fetch(`/api/calendar/events?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        });

        if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch calendar events');
        }

        const data = await response.json();
      
      // Transform the events to the format expected by react-big-calendar
      const calendarEvents = data.events.map((event: {
        id: string;
        title: string;
        startDate: string;
        endDate?: string;
        description?: string;
        location?: string;
        htmlLink?: string;
        isAllDay?: boolean;
      }) => ({
        id: event.id,
        title: event.title,
        start: new Date(event.startDate),
        end: new Date(event.endDate || event.startDate), // Use startDate as fallback
        description: event.description,
        location: event.location,
        htmlLink: event.htmlLink
      }));
      
      setEvents(calendarEvents);
        setIsLoading(false);
    } catch (error: unknown) {
      console.error('Error fetching Google Calendar events:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load calendar events';
      
      // Check if the error is related to the API being disabled
      if (errorMessage.includes('has not been used') || 
          errorMessage.includes('it is disabled') || 
          errorMessage.includes('API has not been enabled')) {
        setApiDisabled(true);
      }
      
      setError(errorMessage);
      setIsLoading(false);
      
      // If unauthorized, clear the googleAuthenticated state
      if (errorMessage.includes('Unauthorized') || errorMessage.includes('Authentication failed')) {
        toast.error('Google Calendar authorization expired. Please reconnect your calendar.');
      }
    }
  };

  // Handle Google Calendar authentication
  const handleConnectGoogleCalendar = async () => {
    try {
      setError(null);
      toast.loading('Connecting to Google Calendar...');
      
      // Get the authorization URL from the server
      const response = await fetch('/api/auth/google-url', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get authorization URL');
      }
      
      const { url } = await response.json();
      
      // Redirect to Google's OAuth page
      window.location.href = url;
    } catch (error: unknown) {
      console.error('Error initiating Google Calendar authentication:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Google Calendar';
      toast.error(errorMessage);
    }
  };

  // Fetch events when component mounts or when googleAuthenticated changes
  useEffect(() => {
    if (googleAuthenticated) {
      fetchGoogleCalendarEvents();
    } else {
      // If not authenticated with Google, set loading to false
      setIsLoading(false);
    }
  }, [googleAuthenticated, timeRange]);

  // Add this useEffect right after the other useEffect hooks
  useEffect(() => {
    // Check if error includes Unauthorized and update the error message
    if (error && (error.includes('Unauthorized') || error.includes('Authentication failed'))) {
      // Update the error state to include information about the authorization
      setError('Google Calendar authorization expired. Please reconnect to continue.');
    }
  }, [error]);

  // Handle view change in the calendar
  const handleRangeChange = (
    range: Date[] | { start: Date; end: Date }
  ) => {
    console.log('Range changed:', range);
    
    // Handle different view types
    let newStart: Date;
    let newEnd: Date;
    
    if (Array.isArray(range)) {
      // For week/day view, use the first and last date
      newStart = range[0];
      newEnd = range[range.length - 1];
    } else if (range.start && range.end) {
      // For month view, use the provided start and end
      newStart = range.start;
      newEnd = range.end;
    } else {
      // If we can't determine the range, don't update
      return;
    }
    
    // Only update if the range has actually changed
    if (
      newStart.getTime() === timeRange.start.getTime() && 
      newEnd.getTime() === timeRange.end.getTime()
    ) {
      return;
    }
    
    // Expand the range a bit to ensure we get all events
    const expandedStart = new Date(newStart);
    expandedStart.setMonth(expandedStart.getMonth() - 1);
    
    const expandedEnd = new Date(newEnd);
    expandedEnd.setMonth(expandedEnd.getMonth() + 1);
    
    console.log('Setting new time range:', {
      start: expandedStart,
      end: expandedEnd
    });
    
    setTimeRange({
      start: expandedStart,
      end: expandedEnd
    });
  };

  // Handle view change
  const handleViewChange = (newView: View) => {
    console.log('View changed to:', newView);
    setCurrentView(newView);
  };

  // Update the handleNavigate function with the correct types
  const handleNavigate = (newDate: Date, view: View, action: NavigateAction) => {
    console.log('Navigation action:', action, 'to date:', newDate, 'view:', view);
    
    // Update the current date
    setCurrentDate(newDate);
    
    // Force refresh events when navigation happens
    setTimeout(() => {
      fetchGoogleCalendarEvents();
    }, 100);
  };

  // Custom event styling
  const eventStyleGetter = (event: CalendarEvent) => {
    // Use event properties to customize styling if needed
    // For example, you could use different colors based on event properties
    const isAllDay = event.start.getDate() === event.end.getDate() && 
                    event.start.getMonth() === event.end.getMonth() &&
                    event.start.getFullYear() === event.end.getFullYear();
    
    return {
      style: {
        backgroundColor: isAllDay ? '#4f46e5' : '#3b82f6', // Different color for all-day events
        color: 'white',
        borderRadius: '4px',
        border: 'none',
        fontWeight: 'bold',
        padding: '2px 5px',
        fontSize: '0.9rem',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
      }
    };
  };

  // Custom day cell styling
  const dayPropGetter = (date: Date) => {
    // Check if this is the currently selected day
    const isSelected = date.toDateString() === currentDate.toDateString();
    
    return {
      className: isSelected ? 'rbc-selected-day' : ''
    };
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show API disabled error state
  if (apiDisabled) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Google Calendar API Not Enabled
            </h2>
          </div>
          
          <div className="p-6">
            <div className="flex items-center mb-4 text-amber-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">Google Calendar API is not enabled for this project</span>
            </div>
            
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              To use the Live Calendar feature, you need to enable the Google Calendar API for this project. Follow these steps:
            </p>
            
            <ol className="list-decimal pl-5 mb-6 space-y-2 text-gray-600 dark:text-gray-400">
              <li>Go to the <a href="https://console.developers.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google API Console</a></li>
              <li>Make sure you&apos;re signed in with the correct Google account</li>
              <li>Select your project (or create a new one)</li>
              <li>Click &quot;Enable&quot; to activate the Google Calendar API</li>
              <li>Return to this page and refresh</li>
            </ol>
            
            <div className="flex justify-end">
              <button
                onClick={fetchGoogleCalendarEvents}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show general error state
  if (error && !apiDisabled) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-red-500">Error</h2>
        <p className="mb-4">{error}</p>
        
        {error.includes('authorization expired') || error.includes('reconnect') ? (
          <div className="flex space-x-2">
            <button
              onClick={handleConnectGoogleCalendar}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              Reconnect to Google Calendar
            </button>
            <button
              onClick={fetchGoogleCalendarEvents}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
            >
              Try Again
            </button>
          </div>
        ) : (
          <button
            onClick={fetchGoogleCalendarEvents}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  // Show authentication prompt if not authenticated with Google
  if (!googleAuthenticated) {
  return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Live Calendar View
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Connect your Google Calendar to see your events
            </p>
          </div>

          <div className="p-6 flex flex-col items-center justify-center">
            <div className="text-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
                Connect to Google Calendar
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                To view your live calendar, you need to connect your Google Calendar account.
              </p>
            </div>
            
            <button
              onClick={handleConnectGoogleCalendar}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                  <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                  <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                  <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                  <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                </g>
              </svg>
              Connect Google Calendar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show calendar with events
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Live Calendar View
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Interactive calendar with your events
          </p>
        </div>

        <div className="p-4" style={{ height: '600px' }}>
          <style jsx global>{`
            /* Calendar container */
            .rbc-calendar {
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #1f2937;
              background-color: white;
            }
            
            /* Dark mode support */
            .dark .rbc-calendar {
              background-color: #1e293b;
              color: #e2e8f0;
            }
            
            /* Header row with day names */
            .rbc-header {
              padding: 10px 3px;
              font-weight: 600;
              font-size: 0.9rem;
              border-bottom: 1px solid #e5e7eb;
              background-color: #f9fafb;
            }
            
            .dark .rbc-header {
              background-color: #334155;
              border-bottom: 1px solid #475569;
              color: #e2e8f0;
            }
            
            /* Month view grid cells */
            .rbc-month-view {
              border: 1px solid #e5e7eb;
              border-radius: 0.375rem;
              overflow: hidden;
            }
            
            .dark .rbc-month-view {
              border: 1px solid #475569;
            }
            
            .rbc-day-bg {
              background-color: white;
            }
            
            .dark .rbc-day-bg {
              background-color: #1e293b;
            }
            
            /* Today's cell */
            .rbc-day-bg.rbc-today {
              background-color: #eff6ff;
            }
            
            .dark .rbc-day-bg.rbc-today {
              background-color: #1e40af;
            }
            
            /* Date number in cell */
            .rbc-date-cell {
              padding: 5px;
              font-size: 0.9rem;
              text-align: right;
            }
            
            .rbc-date-cell.rbc-now {
              font-weight: bold;
              color: #2563eb;
            }
            
            .dark .rbc-date-cell.rbc-now {
              color: #93c5fd;
            }
            
            /* Event styles */
            .rbc-event {
              background-color: #3b82f6;
              border-radius: 4px;
              color: white;
              padding: 2px 5px;
              font-size: 0.85rem;
              border: none;
              font-weight: 500;
              box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            }
            
            .rbc-event.rbc-selected {
              background-color: #2563eb;
              box-shadow: 0 0 0 2px #93c5fd;
            }
            
            /* Event popup styles */
            .rbc-overlay {
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              border: 1px solid #e5e7eb;
              padding: 10px;
              z-index: 100;
            }
            
            .dark .rbc-overlay {
              background-color: #334155;
              border: 1px solid #475569;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            
            .rbc-overlay-header {
              font-weight: 600;
              font-size: 1rem;
              margin-bottom: 8px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e5e7eb;
              color: #1f2937;
            }
            
            .dark .rbc-overlay-header {
              color: #f1f5f9;
              border-bottom: 1px solid #475569;
            }
            
            .rbc-event.rbc-selected {
              background-color: #2563eb;
            }
            
            .dark .rbc-event.rbc-selected {
              background-color: #3b82f6;
              outline: 2px solid #93c5fd;
            }
            
            /* Popup event list */
            .rbc-overlay-header + div {
              max-height: 300px;
              overflow-y: auto;
            }
            
            /* Individual event in popup */
            .rbc-event.rbc-overlay {
              margin-bottom: 5px;
              display: block;
              width: 100%;
              padding: 8px 12px;
              background-color: #3b82f6;
              color: white;
            }
            
            .dark .rbc-event.rbc-overlay {
              background-color: #3b82f6;
              color: white;
            }
            
            /* Popup positioning */
            .rbc-overlay {
              min-width: 200px;
              max-width: 300px;
            }
            
            /* Toolbar styles */
            .rbc-toolbar {
              margin-bottom: 15px;
              padding: 5px;
              font-size: 0.9rem;
            }
            
            .rbc-toolbar button {
              color: #4b5563;
              background-color: white;
              border: 1px solid #d1d5db;
              padding: 6px 12px;
              border-radius: 0.375rem;
              font-weight: 500;
            }
            
            .dark .rbc-toolbar button {
              color: #e2e8f0;
              background-color: #334155;
              border: 1px solid #475569;
            }
            
            .rbc-toolbar button:hover {
              background-color: #f3f4f6;
              border-color: #9ca3af;
            }
            
            .dark .rbc-toolbar button:hover {
              background-color: #475569;
              border-color: #64748b;
            }
            
            .rbc-toolbar button.rbc-active {
              background-color: #3b82f6;
              color: white;
              border-color: #2563eb;
            }
            
            .dark .rbc-toolbar button.rbc-active {
              background-color: #2563eb;
              border-color: #3b82f6;
            }
            
            /* Off-range days (days from other months) */
            .rbc-off-range {
              color: #9ca3af;
            }
            
            .dark .rbc-off-range {
              color: #64748b;
            }
            
            /* More link when there are too many events */
            .rbc-show-more {
              color: #3b82f6;
              font-weight: 500;
              font-size: 0.8rem;
              padding: 2px 5px;
              background-color: transparent;
            }
            
            .dark .rbc-show-more {
              color: #93c5fd;
            }
            
            /* Cell borders */
            .rbc-day-bg + .rbc-day-bg,
            .rbc-header + .rbc-header {
              border-left: 1px solid #e5e7eb;
            }
            
            .dark .rbc-day-bg + .rbc-day-bg,
            .dark .rbc-header + .rbc-header {
              border-left: 1px solid #475569;
            }
            
            .rbc-month-row + .rbc-month-row {
              border-top: 1px solid #e5e7eb;
            }
            
            .dark .rbc-month-row + .rbc-month-row {
              border-top: 1px solid #475569;
            }
            
            /* Time grid (week/day view) */
            .rbc-time-view {
              border: 1px solid #e5e7eb;
              border-radius: 0.375rem;
              overflow: hidden;
            }
            
            .dark .rbc-time-view {
              border: 1px solid #475569;
            }
            
            .rbc-time-content {
              border-top: 1px solid #e5e7eb;
            }
            
            .dark .rbc-time-content {
              border-top: 1px solid #475569;
            }
            
            .rbc-time-header-content {
              border-left: 1px solid #e5e7eb;
            }
            
            .dark .rbc-time-header-content {
              border-left: 1px solid #475569;
            }
            
            .rbc-time-slot {
              color: #6b7280;
            }
            
            .dark .rbc-time-slot {
              color: #94a3b8;
            }
            
            /* Time slots in day/week view */
            .rbc-time-view .rbc-time-gutter,
            .rbc-time-view .rbc-day-slot {
              background-color: white;
            }
            
            .dark .rbc-time-view .rbc-time-gutter,
            .dark .rbc-time-view .rbc-day-slot {
              background-color: #1e293b;
            }
            
            /* Day cell background in day view */
            .rbc-time-view .rbc-day-slot .rbc-time-slot {
              background-color: white;
              border-top: 1px solid #f3f4f6;
            }
            
            .dark .rbc-time-view .rbc-day-slot .rbc-time-slot {
              background-color: #1e293b;
              border-top: 1px solid #334155;
            }
            
            /* Add subtle highlighting for time slots in day/week views */
            .dark .rbc-time-view .rbc-day-slot .rbc-time-slot:nth-child(odd) {
              background-color: rgba(59, 130, 246, 0.03);
            }
            
            .dark .rbc-time-view .rbc-day-slot .rbc-time-slot:nth-child(even) {
              background-color: rgba(59, 130, 246, 0.01);
            }
            
            /* Enhanced current day highlighting in month view */
            .dark .rbc-day-bg.rbc-today {
              background-color: rgba(37, 99, 235, 0.2);
              box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.4);
            }
            
            /* Enhanced current day highlighting in week view */
            .rbc-time-view .rbc-day-slot.rbc-today {
              background-color: rgba(37, 99, 235, 0.05);
            }
            
            .dark .rbc-time-view .rbc-day-slot.rbc-today {
              background-color: rgba(37, 99, 235, 0.08);
            }
            
            /* Enhanced current day highlighting in day view */
            .rbc-time-view.rbc-day-view .rbc-day-slot.rbc-today {
              background-color: rgba(37, 99, 235, 0.05);
            }
            
            .dark .rbc-time-view.rbc-day-view .rbc-day-slot.rbc-today {
              background-color: rgba(37, 99, 235, 0.08);
            }
            
            /* Enhanced current day header in all views */
            .rbc-header.rbc-today {
              background-color: rgba(37, 99, 235, 0.1);
              color: #2563eb;
              font-weight: bold;
            }
            
            .dark .rbc-header.rbc-today {
              background-color: rgba(37, 99, 235, 0.2);
              color: #93c5fd;
              font-weight: bold;
            }
            
            /* Current time indicator */
            .rbc-current-time-indicator {
              background-color: #ef4444;
              height: 2px;
            }
            
            /* Soften the light blue backgrounds in dark mode */
            .dark .rbc-time-column {
              background-color: #1e293b;
            }
            
            .dark .rbc-day-bg.rbc-off-range-bg {
              background-color: #1a202c;
            }
            
            .dark .rbc-day-slot .rbc-event {
              border: 1px solid #1e293b;
            }
            
            .dark .rbc-timeslot-group {
              border-bottom: 1px solid #334155;
            }
            
            /* Day background cells in day view */
            .dark .rbc-time-view .rbc-allday-cell {
              background-color: #1e293b;
              border-bottom: 1px solid #334155;
            }
            
            /* Specific style for day/week time slots */
            .dark .rbc-time-content .rbc-time-column {
              background-color: #293548;
            }
            
            .dark .rbc-day-slot .rbc-time-slot {
              border-top: 1px solid #334155;
            }
            
            /* SPECIFIC VIEW STYLES */
            
            /* Week view - Add subtle highlights */
            .rbc-time-view.rbc-week-view {
              border: 1px solid #bfdbfe;
              box-shadow: 0 0 8px rgba(37, 99, 235, 0.05);
            }
            
            .rbc-time-view.rbc-week-view .rbc-time-header {
              background-color: rgba(37, 99, 235, 0.02);
            }
            
            .dark .rbc-time-view.rbc-week-view {
              border: 1px solid #60a5fa;
              box-shadow: 0 0 8px rgba(37, 99, 235, 0.1);
            }
            
            .dark .rbc-time-view.rbc-week-view .rbc-time-header {
              background-color: rgba(37, 99, 235, 0.05);
            }
            
            /* Highlight the current day column in week view */
            .rbc-time-view.rbc-week-view .rbc-day-slot.rbc-today {
              background-color: rgba(37, 99, 235, 0.05);
            }
            
            .dark .rbc-time-view.rbc-week-view .rbc-day-slot.rbc-today {
              background-color: rgba(37, 99, 235, 0.08);
            }
            
            /* Selected day in week view */
            .rbc-time-view.rbc-week-view .rbc-day-slot.rbc-selected-day {
              background-color: rgba(0, 0, 0, 0.02);
              box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
            }
            
            .dark .rbc-time-view.rbc-week-view .rbc-day-slot.rbc-selected-day {
              background-color: rgba(255, 255, 255, 0.07);
              box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
            }
            
            /* Day view - Add subtle highlights */
            .rbc-time-view.rbc-day-view {
              border: 1px solid #c7d2fe;
              box-shadow: 0 0 8px rgba(129, 140, 248, 0.05);
            }
            
            .rbc-time-view.rbc-day-view .rbc-time-header {
              background-color: rgba(129, 140, 248, 0.02);
            }
            
            .dark .rbc-time-view.rbc-day-view {
              border: 1px solid #818cf8;
              box-shadow: 0 0 8px rgba(129, 140, 248, 0.1);
            }
            
            .dark .rbc-time-view.rbc-day-view .rbc-time-header {
              background-color: rgba(129, 140, 248, 0.05);
            }
            
            /* Selected day in day view */
            .rbc-time-view.rbc-day-view .rbc-day-slot.rbc-selected-day {
              background-color: rgba(0, 0, 0, 0.02);
              box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
            }
            
            .dark .rbc-time-view.rbc-day-view .rbc-day-slot.rbc-selected-day {
              background-color: rgba(255, 255, 255, 0.07);
              box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
            }
            
            /* Agenda view - Add subtle highlights */
            .rbc-agenda-view {
              border: none;
              box-shadow: none;
            }
            
            .rbc-agenda-view table.rbc-agenda-table {
              border: none;
              background-color: white;
            }
            
            .rbc-agenda-view table.rbc-agenda-table thead > tr > th {
              background-color: rgba(167, 139, 250, 0.05);
              color: #4b5563;
            }
            
            .dark .rbc-agenda-view {
              border: none;
              box-shadow: none;
            }
            
            .dark .rbc-agenda-view table.rbc-agenda-table {
              border: none;
            }
            
            .dark .rbc-agenda-view table.rbc-agenda-table thead > tr > th {
              background-color: rgba(167, 139, 250, 0.1);
              color: #e2e8f0;
            }
            
            /* Agenda view table background */
            .dark .rbc-agenda-view table.rbc-agenda-table {
              background-color: #1e293b;
            }
            
            /* Alternating rows in agenda view with subtle highlights */
            .rbc-agenda-view table.rbc-agenda-table tbody > tr:nth-child(odd) > td {
              background-color: rgba(167, 139, 250, 0.02);
            }
            
            .rbc-agenda-view table.rbc-agenda-table tbody > tr:nth-child(even) > td {
              background-color: rgba(167, 139, 250, 0.04);
            }
            
            .dark .rbc-agenda-view table.rbc-agenda-table tbody > tr:nth-child(odd) > td {
              background-color: rgba(167, 139, 250, 0.03);
            }
            
            .dark .rbc-agenda-view table.rbc-agenda-table tbody > tr:nth-child(even) > td {
              background-color: rgba(167, 139, 250, 0.07);
            }
            
            /* Highlight today's row in agenda view */
            .rbc-agenda-view table.rbc-agenda-table .rbc-today {
              background-color: rgba(37, 99, 235, 0.08);
            }
            
            .dark .rbc-agenda-view table.rbc-agenda-table .rbc-today {
              background-color: rgba(37, 99, 235, 0.15);
            }
            
            .rbc-agenda-view table.rbc-agenda-table tbody > tr:hover > td {
              background-color: rgba(79, 70, 229, 0.05);
            }
            
            .dark .rbc-agenda-view table.rbc-agenda-table tbody > tr:hover > td {
              background-color: rgba(79, 70, 229, 0.1);
            }
            
            /* Add header styles for each view */
            .rbc-toolbar button.rbc-active[value="week"]::after {
              content: "";
              display: block;
              width: 100%;
              height: 2px;
              background-color: #3b82f6;
              margin-top: 2px;
            }
            
            .dark .rbc-toolbar button.rbc-active[value="week"]::after {
              content: "";
              display: block;
              width: 100%;
              height: 2px;
              background-color: #60a5fa;
              margin-top: 2px;
            }
            
            .rbc-toolbar button.rbc-active[value="day"]::after {
              content: "";
              display: block;
              width: 100%;
              height: 2px;
              background-color: #6366f1;
              margin-top: 2px;
            }
            
            .dark .rbc-toolbar button.rbc-active[value="day"]::after {
              content: "";
              display: block;
              width: 100%;
              height: 2px;
              background-color: #818cf8;
              margin-top: 2px;
            }
            
            .rbc-toolbar button.rbc-active[value="agenda"]::after {
              content: "";
              display: block;
              width: 100%;
              height: 2px;
              background-color: #8b5cf6;
              margin-top: 2px;
            }
            
            .dark .rbc-toolbar button.rbc-active[value="agenda"]::after {
              content: "";
              display: block;
              width: 100%;
              height: 2px;
              background-color: #a78bfa;
              margin-top: 2px;
            }
            
            .rbc-agenda-time-cell {
              background-color: rgba(243, 244, 246, 0.7);
            }
            
            .dark .rbc-agenda-time-cell {
              background-color: rgba(41, 53, 72, 0.7);
            }
          `}</style>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            views={['month', 'week', 'day', 'agenda']}
            defaultView="month" 
            view={currentView}
            date={currentDate}
            onView={handleViewChange}
            onRangeChange={handleRangeChange}
            onNavigate={handleNavigate}
            tooltipAccessor={(event) => event.description || event.title}
            eventPropGetter={eventStyleGetter}
            dayPropGetter={dayPropGetter}
            ref={calendarRef}
            popup
            selectable
          />
      </div>

        <div className="px-6 py-4 flex justify-between items-center border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing your Google Calendar events
          </p>
          <button
            onClick={fetchGoogleCalendarEvents}
            className="px-3 py-1 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 transition text-sm flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
} 