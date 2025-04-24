import { useState, useEffect } from 'react';
import { Event } from '@/lib/openai';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, CheckIcon } from '@heroicons/react/24/outline';

interface CalendarViewProps {
  events: Event[];
  onEditEvent?: (event: Event, index: number) => void;
  selectedEvents?: Set<number>;
  onToggleSelection?: (index: number) => void;
}

export default function CalendarView({ 
  events, 
  onEditEvent, 
  selectedEvents = new Set(), 
  onToggleSelection 
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventsForSelectedDate, setEventsForSelectedDate] = useState<{event: Event, index: number}[]>([]);

  // Get days for the current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get events for the selected date
  useEffect(() => {
    if (!selectedDate) {
      setEventsForSelectedDate([]);
      return;
    }

    const filteredEvents = events
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => {
        if (!event.startDate) return false;
        try {
          const eventDate = parseISO(event.startDate);
          return isSameDay(eventDate, selectedDate);
        } catch (error) {
          return false;
        }
      });

    setEventsForSelectedDate(filteredEvents);
  }, [selectedDate, events]);

  // Navigate to previous month
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Check if a date has events
  const hasEvents = (date: Date) => {
    return events.some(event => {
      if (!event.startDate) return false;
      try {
        const eventDate = parseISO(event.startDate);
        return isSameDay(eventDate, date);
      } catch (error) {
        return false;
      }
    });
  };

  // Format event time
  const formatEventTime = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = parseISO(dateString);
      return format(date, 'h:mm a');
    } catch (error) {
      return '';
    }
  };

  // Handle edit event
  const handleEditEvent = (event: Event, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEditEvent) {
      onEditEvent(event, index);
    }
  };

  // Handle toggle event selection
  const handleToggleSelection = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection(index);
    }
  };

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => {
        if (!event.startDate) return false;
        try {
          const eventDate = parseISO(event.startDate);
          return isSameDay(eventDate, day);
        } catch (error) {
          return false;
        }
      });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        {/* Calendar Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="bg-gray-50 dark:bg-gray-800 py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {daysInMonth.map((day, dayIdx) => {
            const eventsForDay = getEventsForDay(day);
            const hasEventsForDay = eventsForDay.length > 0;
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            
            return (
              <div
                key={dayIdx}
                onClick={() => setSelectedDate(day)}
                className={`
                  bg-white dark:bg-gray-800 h-24 p-2 cursor-pointer
                  ${isToday(day) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                  ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
                  hover:bg-gray-50 dark:hover:bg-gray-700
                `}
              >
                <div className="flex justify-between">
                  <span
                    className={`
                      text-sm font-medium
                      ${isToday(day) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}
                    `}
                  >
                    {format(day, 'd')}
                  </span>
                  {hasEventsForDay && (
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  )}
                </div>
                
                {/* Show up to 2 event titles in the day cell */}
                <div className="mt-1 overflow-hidden max-h-16">
                  {eventsForDay
                    .slice(0, 2)
                    .map(({ event, index }) => (
                      <div 
                        key={index} 
                        className={`
                          text-xs truncate py-0.5 px-1.5 rounded mb-0.5 flex justify-between items-center
                          ${selectedEvents.has(index) 
                            ? 'bg-blue-500 text-white dark:bg-blue-600' 
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'}
                        `}
                      >
                        <span className="truncate flex-1">{event.title || 'Untitled Event'}</span>
                        <div className="flex items-center ml-1 space-x-1">
                          {onToggleSelection && (
                            <button 
                              onClick={(e) => handleToggleSelection(index, e)}
                              className="p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-700"
                            >
                              {selectedEvents.has(index) ? (
                                <CheckIcon className="h-3 w-3 text-white dark:text-blue-200" />
                              ) : (
                                <div className="h-3 w-3 border border-blue-400 dark:border-blue-300 rounded-sm"></div>
                              )}
                            </button>
                          )}
                          {onEditEvent && (
                            <button 
                              onClick={(e) => handleEditEvent(event, index, e)}
                              className="p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-700"
                            >
                              <PencilIcon className="h-3 w-3 text-blue-700 dark:text-blue-300" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  {eventsForDay.length > 2 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 pl-1.5">
                      +{eventsForDay.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event details for selected date */}
      {selectedDate && (
        <div className="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Events for {format(selectedDate, 'MMMM d, yyyy')}
            </h3>
          </div>
          
          {eventsForSelectedDate.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
              No events scheduled for this day
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {eventsForSelectedDate.map(({ event, index }) => (
                <li key={index} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {onToggleSelection && (
                        <button 
                          onClick={(e) => handleToggleSelection(index, e)}
                          className="flex-shrink-0 h-5 w-5 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          {selectedEvents.has(index) && (
                            <CheckIcon className="h-4 w-4 text-blue-500" />
                          )}
                        </button>
                      )}
                      <h4 className="text-base font-medium text-gray-900 dark:text-gray-100">{event.title || 'Untitled Event'}</h4>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatEventTime(event.startDate)}
                        {event.endDate && ` - ${formatEventTime(event.endDate)}`}
                        {event.isAllDay && ' (All day)'}
                      </span>
                      {onEditEvent && (
                        <button 
                          onClick={(e) => handleEditEvent(event, index, e)}
                          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <PencilIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  {event.location && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ml-8">
                      Location: {event.location}
                    </p>
                  )}
                  {event.description && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ml-8">
                      {event.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
} 