import { useState, useEffect, useRef } from 'react';
import { Event } from '@/lib/openai';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { useAuth } from '@/components/AuthProvider';
import toast from 'react-hot-toast';
import EventEditor from './EventEditor';
import { PencilIcon, PlusIcon, TrashIcon, CheckIcon, CalendarIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';

// Enum for resize directions
enum ResizeDirection {
  TopLeft = 'nwse-resize',
  TopRight = 'nesw-resize',
  BottomLeft = 'nesw-resize',
  BottomRight = 'nwse-resize'
}

// Enum for editor mode
enum EditorMode {
  Add = 'add',
  Edit = 'edit'
}

interface EventListProps {
  events: Event[];
  onClearEvents: () => void;
}

export default function EventList({ events, onClearEvents }: EventListProps) {
  const { user, authenticated, googleCalendarConnected } = useAuth();
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [editingEvent, setEditingEvent] = useState<{ event: Event; index: number } | null>(null);
  const [localEvents, setLocalEvents] = useState<Event[]>([]);
  const [editorPosition, setEditorPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(EditorMode.Edit);
  const [reviewMode, setReviewMode] = useState<'list' | 'day' | 'week' | 'month' | 'fourMonth'>('list');
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(new Date());
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection | null>(null);
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0
  });
  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize state after component mounts to avoid hydration errors
  useEffect(() => {
    setLocalEvents(events);
    setSelectedEvents(new Set(events.map((_, i) => i)));
    const firstDate = events
      .map(event => event.date || event.startDate)
      .find(Boolean);
    if (firstDate) {
      try {
        const parsed = parseISO(firstDate);
        if (!Number.isNaN(parsed.getTime())) setCalendarAnchorDate(parsed);
      } catch {}
    }
  }, [events]);

  // Handle mouse events for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && editorPosition) {
        // Update position while dragging
        setEditorPosition({
          ...editorPosition,
          top: e.clientY - dragOffset.y,
          left: e.clientX - dragOffset.x
        });
      } else if (isResizing && editorPosition && resizeDirection) {
        // Calculate new dimensions based on resize direction
        let newWidth = editorPosition.width;
        let newHeight = editorPosition.height;
        let newTop = editorPosition.top;
        let newLeft = editorPosition.left;

        // Calculate deltas (how much the mouse has moved)
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;

        switch (resizeDirection) {
          case ResizeDirection.BottomRight:
            // Bottom right: straightforward - just extend width and height
            newWidth = Math.max(300, resizeStart.width + deltaX);
            newHeight = Math.max(300, resizeStart.height + deltaY);
            break;

          case ResizeDirection.BottomLeft:
            // Bottom left: extend height, reduce width, adjust left
            newWidth = Math.max(300, resizeStart.width - deltaX);
            newHeight = Math.max(300, resizeStart.height + deltaY);
            newLeft = resizeStart.left + deltaX;
            break;

          case ResizeDirection.TopRight:
            // Top right: REVERSED - pulling toward menu makes it bigger
            // When dragging down (positive deltaY), increase height
            // When dragging left (negative deltaX), increase width
            newWidth = Math.max(300, resizeStart.width - deltaX);
            newHeight = Math.max(300, resizeStart.height + deltaY);
            newTop = resizeStart.top - deltaY;
            newLeft = resizeStart.left + deltaX;
            break;

          case ResizeDirection.TopLeft:
            // Top left: REVERSED - pulling toward menu makes it bigger
            // When dragging down (positive deltaY), increase height
            // When dragging right (positive deltaX), increase width
            newWidth = Math.max(300, resizeStart.width + deltaX);
            newHeight = Math.max(300, resizeStart.height + deltaY);
            newTop = resizeStart.top - deltaY;
            newLeft = resizeStart.left - deltaX;
            break;
        }

        setEditorPosition({
          top: newTop,
          left: newLeft,
          width: newWidth,
          height: newHeight
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, editorPosition, resizeStart, resizeDirection]);

  const handleDragStart = (e: React.MouseEvent, fromBottom = false) => {
    if (!editorPosition || !editorRef.current) return;

    // Prevent default behavior and text selection
    e.preventDefault();

    const rect = editorRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: fromBottom ? e.clientY - rect.bottom + 8 : e.clientY - rect.top
    });

    setIsDragging(true);
  };

  const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
    if (!editorPosition || !editorRef.current) return;

    // Prevent default behavior
    e.preventDefault();

    const rect = editorRef.current.getBoundingClientRect();
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: rect.width,
      height: rect.height,
      top: editorPosition.top,
      left: editorPosition.left
    });

    setResizeDirection(direction);
    setIsResizing(true);
  };

  const toggleEventSelection = (index: number) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedEvents(newSelected);
  };

  const toggleAllEvents = () => {
    if (selectedEvents.size === localEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(localEvents.map((_, i) => i)));
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    try {
      const date = parseISO(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return format(date, 'MMM d, yyyy');
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return dateString || 'Not specified';
    }
  };

  const handleEditEvent = (event: Event, index: number, e: React.MouseEvent) => {
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    const width = Math.min(windowWidth - 32, 560);
    const height = Math.min(windowHeight - 48, 620);
    const left = (windowWidth - width) / 2;
    const top = Math.max(24, (windowHeight - height) / 2);

    setEditorPosition({
      top,
      left,
      width,
      height
    });

    setEditorMode(EditorMode.Edit);
    setEditingEvent({ event, index });
  };

  const handleAddNewEvent = () => {
    // Create a blank event template
    const newEvent: Event = {
      title: '',
      description: '',
      startDate: new Date().toISOString(),
      isAllDay: false
    };

    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    const width = Math.min(windowWidth - 32, 560);
    const height = Math.min(windowHeight - 48, 620);
    const left = (windowWidth - width) / 2;
    const top = Math.max(24, (windowHeight - height) / 2);

    setEditorPosition({
      top,
      left,
      width,
      height
    });

    setEditorMode(EditorMode.Add);
    setEditingEvent({ event: newEvent, index: -1 });
  };

  const handleSaveEdit = (updatedEvent: Event) => {
    if (editingEvent === null) return;

    const newEvents = [...localEvents];

    if (editorMode === EditorMode.Add) {
      // Add the new event to the list
      newEvents.push(updatedEvent);
      setSelectedEvents(new Set([...selectedEvents, newEvents.length - 1]));
      toast.success('Event added successfully');
    } else {
      // Update existing event
      newEvents[editingEvent.index] = updatedEvent;
      toast.success('Event updated successfully');
    }

    setLocalEvents(newEvents);
    setEditingEvent(null);
    setEditorPosition(null);
  };

  const handleCancelEdit = () => {
    setEditingEvent(null);
    setEditorPosition(null);
  };

  const handleAddToCalendar = async () => {
    if (!authenticated) {
      toast.error('Please sign in with Google to add events to your calendar');
      return;
    }

    if (!googleCalendarConnected) {
      toast.error('Please grant calendar access to add events to your calendar');
      return;
    }

    if (selectedEvents.size === 0) {
      toast.error('Please select at least one event to add to your calendar');
      return;
    }

    setIsAddingToCalendar(true);
    const toastId = toast.loading('Adding events to your calendar...');

    try {
      const selectedEventsArray = Array.from(selectedEvents).map(index => localEvents[index]);

      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          events: selectedEventsArray
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to add events to calendar');
      }

      const data = await response.json();
      toast.success(`Successfully added ${data.eventIds.length} events to your calendar!`, { id: toastId });

      // Clear events and redirect to live calendar tab instead of upload tab
      onClearEvents();

      // Use window location to redirect to the live calendar tab
      const currentUrl = window.location.href.split('#')[0];
      window.location.href = `${currentUrl}#live-calendar`;

      // Find and click the live calendar tab button to activate it
      setTimeout(() => {
        const liveCalendarButton = document.querySelector('button.tab[aria-label="Live Calendar"]') as HTMLButtonElement;
        if (liveCalendarButton) {
          liveCalendarButton.click();
        } else {
          // Fallback: Try to find the button by text content
          const allButtons = document.querySelectorAll('button.tab');
          for (const button of allButtons) {
            if (button.textContent?.includes('Live Calendar')) {
              (button as HTMLButtonElement).click();
              break;
            }
          }
        }
      }, 100);
    } catch (error: any) {
      console.error('Error adding events to calendar:', error);
      toast.error(error.message || 'Failed to add events to your calendar', { id: toastId });
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  const handleConnectCalendar = async () => {
    setIsConnectingCalendar(true);
    try {
      const res = await fetch(`/api/google-calendar/authorize?next=${encodeURIComponent('/scan#events')}`);
      if (!res.ok) throw new Error('Failed to start Google Calendar authorization');
      const { url } = await res.json();
      if (!url) throw new Error('Missing Google authorization URL');
      window.location.href = url;
    } catch (error) {
      console.error('Error connecting Google Calendar:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to connect Google Calendar');
      setIsConnectingCalendar(false);
    }
  };

  if (localEvents.length === 0) {
    return null;
  }

  const sortedEvents = localEvents
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const left = a.event.date || a.event.startDate || '';
      const right = b.event.date || b.event.startDate || '';
      return left.localeCompare(right);
    });

  const getEventDate = (event: Event) => {
    const rawDate = event.date || event.startDate;
    if (!rawDate) return null;
    try {
      const parsed = parseISO(rawDate);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  };

  const eventsForDay = (day: Date) => sortedEvents.filter(({ event }) => {
    const eventDate = getEventDate(event);
    return eventDate ? isSameDay(eventDate, day) : false;
  });

  const calendarTitle = (() => {
    if (reviewMode === 'day') return format(calendarAnchorDate, 'EEEE, MMM d');
    if (reviewMode === 'week') return `${format(startOfWeek(calendarAnchorDate), 'MMM d')} - ${format(endOfWeek(calendarAnchorDate), 'MMM d')}`;
    if (reviewMode === 'fourMonth') return `${format(calendarAnchorDate, 'MMM yyyy')} - ${format(addMonths(calendarAnchorDate, 3), 'MMM yyyy')}`;
    return format(calendarAnchorDate, 'MMMM yyyy');
  })();

  const moveCalendar = (direction: -1 | 1) => {
    if (reviewMode === 'day') setCalendarAnchorDate(addDays(calendarAnchorDate, direction));
    else if (reviewMode === 'week') setCalendarAnchorDate(addDays(calendarAnchorDate, direction * 7));
    else if (reviewMode === 'fourMonth') setCalendarAnchorDate(addMonths(calendarAnchorDate, direction * 4));
    else setCalendarAnchorDate(direction > 0 ? addMonths(calendarAnchorDate, 1) : subMonths(calendarAnchorDate, 1));
  };

  const renderCalendarEvent = (event: Event, index: number, compact = false) => (
    <button
      key={`${event.title}-${index}`}
      type="button"
      className={`calendar-event-chip ${selectedEvents.has(index) ? 'selected' : ''} ${compact ? 'compact' : ''}`}
      onClick={(e) => handleEditEvent(event, index, e)}
      title="Edit event"
    >
      <span>{event.title || 'Untitled Event'}</span>
      {!compact && <small>{event.isAllDay ? 'All day' : [event.startTime, event.endTime].filter(Boolean).join(' - ') || 'No time'}</small>}
    </button>
  );

  const renderMonthGrid = (monthDate: Date, compact = false) => {
    const gridStart = startOfWeek(startOfMonth(monthDate));
    const gridEnd = endOfWeek(endOfMonth(monthDate));
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    return (
      <div className={`calendar-month ${compact ? 'compact' : ''}`}>
        <div className="calendar-month-title">{format(monthDate, 'MMMM yyyy')}</div>
        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid">
          {days.map(day => {
            const dayEvents = eventsForDay(day);
            const inMonth = day >= startOfMonth(monthDate) && day <= endOfMonth(monthDate);
            return (
              <div key={day.toISOString()} className={`calendar-day-cell ${inMonth ? '' : 'muted'}`}>
                <div className="calendar-day-number">{format(day, 'd')}</div>
                <div className="calendar-day-events">
                  {dayEvents.slice(0, compact ? 2 : 3).map(({ event, index }) => renderCalendarEvent(event, index, compact))}
                  {dayEvents.length > (compact ? 2 : 3) && <span className="calendar-more">+{dayEvents.length - (compact ? 2 : 3)} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="event-list-container liquid-glass">
      <div className="event-list-header">
        <div className="event-list-heading-row">
          <div>
            <p className="event-list-kicker">Review before sync</p>
            <h2 className="event-list-title">
              Extracted Events ({localEvents.length})
            </h2>
          </div>

          <div className="review-mode-toggle" aria-label="Review display mode">
            <button type="button" className={reviewMode === 'list' ? 'active' : ''} onClick={() => setReviewMode('list')}>
              List
            </button>
            <button type="button" className={reviewMode === 'day' ? 'active' : ''} onClick={() => setReviewMode('day')}>
              Day
            </button>
            <button type="button" className={reviewMode === 'week' ? 'active' : ''} onClick={() => setReviewMode('week')}>
              Week
            </button>
            <button type="button" className={reviewMode === 'month' ? 'active' : ''} onClick={() => setReviewMode('month')}>
              Month
            </button>
            <button type="button" className={reviewMode === 'fourMonth' ? 'active' : ''} onClick={() => setReviewMode('fourMonth')}>
              4 Month
            </button>
          </div>
        </div>

        <div className="event-list-actions">
          <button
            type="button"
            onClick={handleAddNewEvent}
            className="add-event-button"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Event
          </button>

          <button
            type="button"
            onClick={toggleAllEvents}
            className="select-all-button"
          >
            <CheckIcon className="h-4 w-4 mr-1" />
            {selectedEvents.size === localEvents.length ? 'Deselect All' : 'Select All'}
          </button>

          <button
            type="button"
            onClick={onClearEvents}
            className="clear-events-button"
          >
            <TrashIcon className="h-4 w-4 mr-1" />
            Clear All
          </button>
        </div>
      </div>

      {reviewMode === 'list' && (
        <div className="event-list">
          {localEvents.map((event, index) => (
            <div key={index} className="event-item">
            <div className="event-checkbox">
              <input
                type="checkbox"
                checked={selectedEvents.has(index)}
                onChange={() => toggleEventSelection(index)}
                id={`event-${index}`}
                className="hidden-checkbox"
              />
              <label
                htmlFor={`event-${index}`}
                className="custom-checkbox"
                aria-label={selectedEvents.has(index) ? "Selected event" : "Unselected event"}
              >
                {selectedEvents.has(index) && (
                  <CheckIcon className="checkbox-icon" />
                )}
              </label>
            </div>

            <div className="event-content">
              <label htmlFor={`event-${index}`} className="event-title">
                {event.title || 'Untitled Event'}
              </label>

              <div className="event-details">
                <div className="event-time">
                  <span className="detail-label">Date:</span> {formatDate(event.date || event.startDate)}
                </div>

                {event.startTime && (
                  <div className="event-time">
                    <span className="detail-label">Start:</span> {event.startTime}
                  </div>
                )}

                {event.endTime && (
                  <div className="event-time">
                    <span className="detail-label">End:</span> {event.endTime}
                  </div>
                )}

                {event.isAllDay && (
                  <div className="event-badge">All day event</div>
                )}

                {event.location && (
                  <div className="event-location">
                    <span className="detail-label">Location:</span> {event.location}
                  </div>
                )}

                {event.description && (
                  <div className="event-description">
                    <span className="detail-label">Description:</span> {event.description}
                  </div>
                )}

                {event.type && (
                  <div className="event-type">
                    <span className={`event-type-badge event-type-${event.type}`}>{event.type}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              className="event-edit-button"
              onClick={(e) => handleEditEvent(event, index, e)}
              aria-label="Edit event"
            >
              <PencilIcon className="edit-icon" />
            </button>
          </div>
          ))}
        </div>
      )}

      {reviewMode !== 'list' && (
        <div className="calendar-review">
          <div className="calendar-toolbar">
            <button type="button" onClick={() => moveCalendar(-1)}>Prev</button>
            <strong>{calendarTitle}</strong>
            <button type="button" onClick={() => setCalendarAnchorDate(new Date())}>Today</button>
            <button type="button" onClick={() => moveCalendar(1)}>Next</button>
          </div>

          {reviewMode === 'day' && (
            <div className="calendar-day-view">
              <div className="day-column">
                <div className="day-column-title">{format(calendarAnchorDate, 'EEEE')}</div>
                <div className="day-column-date">{format(calendarAnchorDate, 'MMM d, yyyy')}</div>
                <div className="day-agenda">
                  {eventsForDay(calendarAnchorDate).length === 0 ? (
                    <p>No extracted events for this day.</p>
                  ) : (
                    eventsForDay(calendarAnchorDate).map(({ event, index }) => renderCalendarEvent(event, index))
                  )}
                </div>
              </div>
            </div>
          )}

          {reviewMode === 'week' && (
            <div className="calendar-week-view">
              {eachDayOfInterval({ start: startOfWeek(calendarAnchorDate), end: endOfWeek(calendarAnchorDate) }).map(day => (
                <div key={day.toISOString()} className="week-day-column">
                  <div className="week-day-title">{format(day, 'EEE')}</div>
                  <div className="week-day-date">{format(day, 'd')}</div>
                  <div className="week-events">
                    {eventsForDay(day).map(({ event, index }) => renderCalendarEvent(event, index, true))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {reviewMode === 'month' && renderMonthGrid(calendarAnchorDate)}

          {reviewMode === 'fourMonth' && (
            <div className="four-month-grid">
              {[0, 1, 2, 3].map(offset => (
                <div key={offset} className="four-month-card">
                  {renderMonthGrid(addMonths(calendarAnchorDate, offset), true)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="event-list-footer">
        <button
          type="button"
          onClick={handleAddToCalendar}
          disabled={selectedEvents.size === 0 || isAddingToCalendar || !authenticated || !googleCalendarConnected}
          className="add-to-calendar-button"
        >
          {isAddingToCalendar ? (
            <>
              <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <CalendarIcon className="h-4 w-4 mr-2" />
              Add {selectedEvents.size} Events to Calendar
            </>
          )}
        </button>

        {!authenticated && (
          <div className="auth-message">
            Please sign in to add events to your calendar
          </div>
        )}

        {authenticated && !googleCalendarConnected && (
          <div className="auth-message">
            <span>Please grant calendar access to add events.</span>
            <button
              type="button"
              onClick={handleConnectCalendar}
              disabled={isConnectingCalendar}
              className="calendar-connect-button"
            >
              {isConnectingCalendar ? 'Opening Google...' : 'Connect Google Calendar'}
            </button>
          </div>
        )}
      </div>

      {editingEvent && editorPosition && (
        <div
          ref={editorRef}
          className="event-editor-container liquid-glass"
          style={{
            top: `${editorPosition.top}px`,
            left: `${editorPosition.left}px`,
            width: `${editorPosition.width}px`,
            height: `${editorPosition.height}px`,
          }}
        >
          {/* Top resize handle */}
          <div
            className="resize-handle resize-handle-top"
            onMouseDown={(e) => handleResizeStart(e, ResizeDirection.TopLeft)}
          ></div>

          {/* Top-right resize handle */}
          <div
            className="resize-handle resize-handle-top-right"
            onMouseDown={(e) => handleResizeStart(e, ResizeDirection.TopRight)}
          ></div>

          {/* Right resize handle */}
          <div
            className="resize-handle resize-handle-right"
            onMouseDown={(e) => handleResizeStart(e, ResizeDirection.BottomRight)}
          ></div>

          {/* Bottom-right resize handle */}
          <div
            className="resize-handle resize-handle-bottom-right"
            onMouseDown={(e) => handleResizeStart(e, ResizeDirection.BottomRight)}
          ></div>

          {/* Bottom resize handle */}
          <div
            className="resize-handle resize-handle-bottom"
            onMouseDown={(e) => handleResizeStart(e, ResizeDirection.BottomRight)}
          ></div>

          {/* Bottom-left resize handle */}
          <div
            className="resize-handle resize-handle-bottom-left"
            onMouseDown={(e) => handleResizeStart(e, ResizeDirection.BottomLeft)}
          ></div>

          {/* Left resize handle */}
          <div
            className="resize-handle resize-handle-left"
            onMouseDown={(e) => handleResizeStart(e, ResizeDirection.BottomLeft)}
          ></div>

          {/* Top-left resize handle */}
          <div
            className="resize-handle resize-handle-top-left"
            onMouseDown={(e) => handleResizeStart(e, ResizeDirection.TopLeft)}
          ></div>

          {/* Draggable header */}
          <div
            className="editor-drag-handle"
            onMouseDown={(e) => handleDragStart(e)}
          >
            <div className="editor-controls">
              <button
                onClick={handleCancelEdit}
                className="editor-close-button"
                aria-label="Close editor"
              >
                <XMarkIcon className="close-icon" />
              </button>
            </div>
          </div>

          <EventEditor
            event={editingEvent.event}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
            mode={editorMode}
          />

          {/* Draggable footer */}
          <div
            className="editor-drag-handle editor-footer"
            onMouseDown={(e) => handleDragStart(e, true)}
          >
            <div className="resize-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .event-list-container {
          border-radius: 1rem;
          overflow: hidden;
        }

        .event-list-header {
          padding: 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .event-list-heading-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .event-list-kicker {
          margin: 0 0 0.25rem;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.46);
        }

        .event-list-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
          color: white;
        }

        .review-mode-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
        }

        .review-mode-toggle button {
          border: 0;
          border-radius: 999px;
          padding: 0.45rem 0.7rem;
          background: transparent;
          color: rgba(255, 255, 255, 0.68);
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
        }

        .review-mode-toggle button.active {
          background: white;
          color: black;
        }

        .event-list-actions {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .add-event-button,
        .select-all-button,
        .clear-events-button {
          display: inline-flex;
          align-items: center;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: var(--radius);
          transition: all 0.2s;
          cursor: pointer;
        }

        .add-event-button {
          background-color: white;
          color: black;
        }

        .add-event-button:hover {
          background-color: rgba(255, 255, 255, 0.86);
        }

        .select-all-button,
        .clear-events-button {
          background-color: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: rgba(255, 255, 255, 0.86);
        }

        :global(.dark) .select-all-button,
        :global(.dark) .clear-events-button {
          border-color: rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.9);
        }

        .select-all-button:hover,
        .clear-events-button:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        :global(.dark) .select-all-button:hover,
        :global(.dark) .clear-events-button:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }

        .event-list {
          max-height: min(52vh, 520px);
          overflow-y: auto;
          padding: 0.5rem;
        }

        .event-item {
          display: flex;
          align-items: flex-start;
          padding: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          position: relative;
        }

        .event-item:last-child {
          border-bottom: none;
        }

        .event-checkbox {
          margin-right: 1rem;
          padding-top: 0.25rem;
        }

        .hidden-checkbox {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .custom-checkbox {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.58);
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
          background-color: transparent;
        }

        .hidden-checkbox:checked + .custom-checkbox {
          background-color: white;
        }

        .checkbox-icon {
          width: 14px;
          height: 14px;
          color: black;
        }

        :global(.checkbox-icon) {
          width: 14px !important;
          height: 14px !important;
          color: black !important;
        }

        .event-content {
          flex: 1;
        }

        .event-title {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: white;
          cursor: pointer;
        }

        :global(.dark) .event-title {
          color: white;
        }

        .event-details {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.7);
          opacity: 1;
        }

        :global(.dark) .event-details {
          color: rgba(255, 255, 255, 0.9);
          opacity: 0.9;
        }

        .event-time,
        .event-location,
        .event-description {
          margin-bottom: 0.25rem;
        }

        .detail-label {
          font-weight: 500;
          margin-right: 0.25rem;
        }

        :global(.dark) .detail-label {
          color: rgba(255, 255, 255, 0.95);
        }

        .event-badge {
          display: inline-block;
          background-color: rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 0.75rem;
          padding: 0.125rem 0.375rem;
          border-radius: 9999px;
          margin-bottom: 0.25rem;
        }

        .event-type-badge {
          display: inline-block;
          font-size: 0.75rem;
          padding: 0.125rem 0.375rem;
          border-radius: 9999px;
          margin-bottom: 0.25rem;
          background-color: #e5e7eb;
          color: #374151;
        }

        .event-type-class {
          background-color: #dbeafe;
          color: #1e40af;
        }

        .event-type-assignment {
          background-color: #fef3c7;
          color: #92400e;
        }

        .event-type-exam {
          background-color: #fee2e2;
          color: #b91c1c;
        }

        .event-type-discussion {
          background-color: #d1fae5;
          color: #065f46;
        }

        :global(.dark) .event-type-badge {
          opacity: 0.9;
        }

        :global(.dark) .event-type-class {
          background-color: rgba(30, 64, 175, 0.3);
          color: #93c5fd;
        }

        :global(.dark) .event-type-assignment {
          background-color: rgba(146, 64, 14, 0.3);
          color: #fcd34d;
        }

        :global(.dark) .event-type-exam {
          background-color: rgba(185, 28, 28, 0.3);
          color: #fca5a5;
        }

        :global(.dark) .event-type-discussion {
          background-color: rgba(6, 95, 70, 0.3);
          color: #6ee7b7;
        }

        .event-edit-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background-color: rgba(255, 255, 255, 0.07);
          color: rgba(255, 255, 255, 0.86);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
          margin-left: 0.5rem;
        }

        .event-edit-button:hover {
          background-color: white;
          color: black;
        }

        :global(.edit-icon) {
          width: 18px !important;
          height: 18px !important;
        }

        .event-list-footer {
          padding: 1.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .calendar-review {
          max-height: min(52vh, 520px);
          overflow-y: auto;
          padding: 1rem;
        }

        .calendar-toolbar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 0.875rem;
          color: white;
        }

        .calendar-toolbar strong {
          min-width: 13rem;
          text-align: center;
          font-size: 0.95rem;
        }

        .calendar-toolbar button {
          padding: 0.45rem 0.7rem;
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          color: white;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
        }

        .calendar-day-view {
          display: grid;
          place-items: center;
        }

        .day-column {
          width: min(100%, 520px);
          min-height: 20rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          background: rgba(255, 255, 255, 0.05);
          padding: 1rem;
          color: white;
        }

        .day-column-title {
          font-size: 1.15rem;
          font-weight: 800;
        }

        .day-column-date {
          color: rgba(255, 255, 255, 0.58);
          margin-bottom: 1rem;
        }

        .day-agenda,
        .week-events,
        .calendar-day-events {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .day-agenda p {
          color: rgba(255, 255, 255, 0.5);
          margin-top: 2rem;
          text-align: center;
        }

        .calendar-week-view {
          display: grid;
          grid-template-columns: repeat(7, minmax(112px, 1fr));
          overflow-x: auto;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
        }

        .week-day-column {
          min-height: 22rem;
          padding: 0.65rem;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.035);
        }

        .week-day-column:last-child {
          border-right: 0;
        }

        .week-day-title {
          color: white;
          font-size: 0.82rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .week-day-date {
          color: rgba(255, 255, 255, 0.52);
          margin-bottom: 0.7rem;
        }

        .calendar-month-title {
          margin-bottom: 0.6rem;
          color: white;
          font-size: 0.95rem;
          font-weight: 800;
          text-align: center;
        }

        .calendar-weekdays,
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }

        .calendar-weekdays span {
          padding: 0.45rem;
          color: rgba(255, 255, 255, 0.45);
          font-size: 0.72rem;
          font-weight: 800;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .calendar-grid {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          overflow: hidden;
        }

        .calendar-day-cell {
          min-height: 7.5rem;
          padding: 0.5rem;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.035);
        }

        .calendar-day-cell.muted {
          opacity: 0.35;
        }

        .calendar-day-number {
          margin-bottom: 0.35rem;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.8rem;
          font-weight: 800;
        }

        .calendar-event-chip {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 0.55rem;
          background: rgba(255, 255, 255, 0.08);
          color: white;
          padding: 0.42rem 0.5rem;
          text-align: left;
          cursor: pointer;
          overflow: hidden;
        }

        .calendar-event-chip.selected {
          background: rgba(147, 197, 253, 0.22);
          border-color: rgba(147, 197, 253, 0.38);
        }

        .calendar-event-chip span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.78rem;
          font-weight: 750;
        }

        .calendar-event-chip small {
          display: block;
          color: rgba(255, 255, 255, 0.58);
          font-size: 0.7rem;
          margin-top: 0.1rem;
        }

        .calendar-event-chip.compact {
          padding: 0.28rem 0.36rem;
        }

        .calendar-event-chip.compact span {
          font-size: 0.68rem;
        }

        .calendar-more {
          color: rgba(255, 255, 255, 0.48);
          font-size: 0.7rem;
          font-weight: 700;
        }

        .four-month-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }

        .calendar-month.compact .calendar-day-cell {
          min-height: 5.4rem;
          padding: 0.36rem;
        }

        .calendar-month.compact .calendar-weekdays span {
          padding: 0.3rem;
          font-size: 0.62rem;
        }

        :global(.dark) .event-list-footer {
          border-top-color: rgba(255, 255, 255, 0.1);
        }

        .add-to-calendar-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.625rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          background-color: white;
          color: black;
          border: none;
          border-radius: var(--radius);
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          max-width: 300px;
        }

        .add-to-calendar-button:hover:not(:disabled) {
          background-color: rgba(255, 255, 255, 0.86);
        }

        .add-to-calendar-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .auth-message {
          margin-top: 0.75rem;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.68);
          opacity: 0.7;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.625rem;
        }

        :global(.dark) .auth-message {
          color: rgba(255, 255, 255, 0.7);
        }

        .calendar-connect-button {
          padding: 0.5rem 0.875rem;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, opacity 0.2s;
        }

        .calendar-connect-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.18);
        }

        .calendar-connect-button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .calendar-container {
          height: 500px;
          padding: 1rem;
        }

        /* Editor styles */
        .event-editor-container {
          position: fixed;
          border-radius: 1rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          z-index: 100;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-width: min(360px, calc(100vw - 32px));
          min-height: 0;
          max-width: calc(100vw - 32px);
          max-height: calc(100dvh - 48px);
        }

        .editor-drag-handle {
          padding: 0.75rem 1rem;
          background-color: rgba(255, 255, 255, 0.04);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          cursor: move;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          user-select: none;
          background-color: rgba(255, 255, 255, 0.04);
        }

        .editor-controls {
          display: flex;
          align-items: center;
        }

        .editor-close-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.12);
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          color: white;
          position: relative;
        }

        :global(.close-icon) {
          width: 18px !important;
          height: 18px !important;
          color: white !important;
          position: absolute !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
        }

        :global(.dark) .editor-close-button {
          background-color: rgba(255, 255, 255, 0.2);
        }

        :global(.dark) .close-icon {
          color: white !important;
        }

        .editor-close-button:hover {
          background-color: rgba(0, 0, 0, 0.2);
        }

        :global(.dark) .editor-close-button:hover {
          background-color: rgba(255, 255, 255, 0.3);
        }

        .resize-handle {
          display: none;
        }

        @media (max-width: 760px) {
          .event-list-heading-row {
            flex-direction: column;
          }

          .review-mode-toggle {
            width: 100%;
            justify-content: space-between;
            overflow-x: auto;
          }

          .review-mode-toggle button {
            flex: 1 0 auto;
          }

          .event-item {
            padding: 0.875rem 0.75rem;
          }

          .event-editor-container {
            top: 12px !important;
            left: 12px !important;
            width: calc(100vw - 24px) !important;
            height: calc(100dvh - 24px) !important;
          }

          .calendar-toolbar {
            justify-content: flex-start;
            overflow-x: auto;
          }

          .calendar-toolbar strong {
            min-width: 10rem;
          }

          .calendar-week-view {
            grid-template-columns: repeat(7, minmax(9rem, 1fr));
          }

          .calendar-grid {
            min-width: 720px;
          }

          .four-month-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
