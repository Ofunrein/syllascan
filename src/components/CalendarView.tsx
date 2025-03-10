import { useState, useEffect } from 'react';
import { Event } from '@/lib/openai';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface CalendarViewProps {
  events: Event[];
}

export default function CalendarView({ events }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventsForSelectedDate, setEventsForSelectedDate] = useState<Event[]>([]);

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

    const filteredEvents = events.filter(event => {
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Calendar Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <ChevronRightIcon className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="bg-gray-50 py-2 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {daysInMonth.map((day, dayIdx) => {
            const hasEventsForDay = hasEvents(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            
            return (
              <div
                key={dayIdx}
                onClick={() => setSelectedDate(day)}
                className={`
                  bg-white h-24 p-2 cursor-pointer
                  ${isToday(day) ? 'bg-blue-50' : ''}
                  ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
                  hover:bg-gray-50
                `}
              >
                <div className="flex justify-between">
                  <span
                    className={`
                      text-sm font-medium
                      ${isToday(day) ? 'text-blue-600' : 'text-gray-900'}
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
                  {events
                    .filter(event => {
                      if (!event.startDate) return false;
                      try {
                        const eventDate = parseISO(event.startDate);
                        return isSameDay(eventDate, day);
                      } catch (error) {
                        return false;
                      }
                    })
                    .slice(0, 2)
                    .map((event, idx) => (
                      <div 
                        key={idx} 
                        className="text-xs truncate py-0.5 px-1.5 rounded bg-blue-100 text-blue-800 mb-0.5"
                      >
                        {event.title}
                      </div>
                    ))}
                  {events.filter(event => {
                    if (!event.startDate) return false;
                    try {
                      const eventDate = parseISO(event.startDate);
                      return isSameDay(eventDate, day);
                    } catch (error) {
                      return false;
                    }
                  }).length > 2 && (
                    <div className="text-xs text-gray-500 pl-1.5">
                      +{events.filter(event => {
                        if (!event.startDate) return false;
                        try {
                          const eventDate = parseISO(event.startDate);
                          return isSameDay(eventDate, day);
                        } catch (error) {
                          return false;
                        }
                      }).length - 2} more
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
        <div className="mt-6 bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Events for {format(selectedDate, 'MMMM d, yyyy')}
            </h3>
          </div>
          
          {eventsForSelectedDate.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No events scheduled for this day
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {eventsForSelectedDate.map((event, idx) => (
                <li key={idx} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex justify-between">
                    <h4 className="text-base font-medium text-gray-900">{event.title}</h4>
                    <span className="text-sm text-gray-500">
                      {formatEventTime(event.startDate)}
                      {event.endDate && ` - ${formatEventTime(event.endDate)}`}
                      {event.isAllDay && ' (All day)'}
                    </span>
                  </div>
                  {event.location && (
                    <p className="mt-1 text-sm text-gray-500">
                      Location: {event.location}
                    </p>
                  )}
                  {event.description && (
                    <p className="mt-1 text-sm text-gray-500">
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