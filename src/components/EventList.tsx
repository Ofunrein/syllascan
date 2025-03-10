import { useState, useEffect, useRef } from 'react';
import { Event } from '@/lib/openai';
import { format, parseISO } from 'date-fns';
import { useUser } from '@/lib/UserContext';
import toast from 'react-hot-toast';
import EventEditor from './EventEditor';
import CalendarView from './CalendarView';
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
  const { user, authenticated, googleAuthenticated } = useUser();
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const [editingEvent, setEditingEvent] = useState<{ event: Event; index: number } | null>(null);
  const [localEvents, setLocalEvents] = useState<Event[]>([]);
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');
  const [editorPosition, setEditorPosition] = useState<{ 
    top: number; 
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(EditorMode.Edit);
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
    if (!dateString) return 'N/A';
    try {
      const date = parseISO(dateString);
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      return dateString;
    }
  };

  const handleEditEvent = (event: Event, index: number, e: React.MouseEvent) => {
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    
    // Calculate initial position - centered in viewport with larger default size
    const width = Math.min(windowWidth - 40, 600); // Max width of 600px or window width - 40px
    const height = Math.min(windowHeight - 40, 700); // Max height of 700px or window height - 40px
    const left = (windowWidth - width) / 2;
    const top = scrollTop + (windowHeight - height) / 2;
    
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
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    
    // Calculate initial position - centered in viewport with larger default size
    const width = Math.min(windowWidth - 40, 600); // Max width of 600px or window width - 40px
    const height = Math.min(windowHeight - 40, 700); // Max height of 700px or window height - 40px
    const left = (windowWidth - width) / 2;
    const top = scrollTop + (windowHeight - height) / 2;
    
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

    if (!googleAuthenticated) {
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
      onClearEvents();
    } catch (error: any) {
      console.error('Error adding events to calendar:', error);
      toast.error(error.message || 'Failed to add events to your calendar', { id: toastId });
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  if (localEvents.length === 0) {
    return null;
  }

  return (
    <div className="event-list-container">
      <div className="event-list-header">
        <h2 className="event-list-title">
          Extracted Events ({localEvents.length})
        </h2>
        
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
        
        <div className="view-toggle">
            <button
              type="button"
              onClick={() => setActiveView('list')}
            className={`view-toggle-button ${activeView === 'list' ? 'active' : ''}`}
          >
            List View
            </button>
            <button
              type="button"
              onClick={() => setActiveView('calendar')}
            className={`view-toggle-button ${activeView === 'calendar' ? 'active' : ''}`}
            >
              Calendar View
            </button>
          </div>
        </div>

      {activeView === 'list' ? (
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
                    <span className="detail-label">Start:</span> {formatDate(event.startDate)}
                        </div>
                  
                            {event.endDate && (
                    <div className="event-time">
                      <span className="detail-label">End:</span> {formatDate(event.endDate)}
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
      ) : (
        <div className="calendar-container">
          <CalendarView events={localEvents} />
            </div>
      )}
      
      <div className="event-list-footer">
              <button
          type="button"
                onClick={handleAddToCalendar}
                disabled={selectedEvents.size === 0 || isAddingToCalendar || !authenticated || !googleAuthenticated}
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
        
        {authenticated && !googleAuthenticated && (
          <div className="auth-message">
            Please grant calendar access to add events
          </div>
        )}
      </div>

      {editingEvent && editorPosition && (
        <div 
          ref={editorRef}
          className="event-editor-container"
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
          background-color: var(--card);
          border-radius: var(--radius);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .event-list-header {
          padding: 1.25rem;
          border-bottom: 1px solid var(--border);
        }
        
        .event-list-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: var(--foreground);
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
          background-color: var(--primary);
          color: white;
        }
        
        :global(.dark) .add-event-button {
          background-color: var(--primary-light);
        }
        
        .add-event-button:hover {
          background-color: var(--primary-dark);
        }
        
        :global(.dark) .add-event-button:hover {
          background-color: var(--primary);
        }
        
        .select-all-button,
        .clear-events-button {
          background-color: transparent;
          border: 1px solid var(--border);
          color: var(--foreground);
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
        
        .view-toggle {
          display: flex;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        
        :global(.dark) .view-toggle {
          border-color: rgba(255, 255, 255, 0.2);
        }
        
        .view-toggle-button {
          flex: 1;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--foreground);
        }
        
        :global(.dark) .view-toggle-button {
          color: rgba(255, 255, 255, 0.8);
        }
        
        .view-toggle-button.active {
          background-color: var(--primary);
          color: white;
        }
        
        :global(.dark) .view-toggle-button.active {
          background-color: var(--primary-light);
          color: var(--background);
        }
        
        .event-list {
          max-height: 500px;
          overflow-y: auto;
          padding: 0.5rem;
        }
        
        .event-item {
          display: flex;
          align-items: flex-start;
          padding: 1rem;
          border-bottom: 1px solid var(--border);
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
          border: 2px solid var(--primary);
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
          background-color: transparent;
        }
        
        :global(.dark) .custom-checkbox {
          border-color: var(--primary-light);
        }
        
        .hidden-checkbox:checked + .custom-checkbox {
          background-color: var(--primary);
        }
        
        :global(.dark) .hidden-checkbox:checked + .custom-checkbox {
          background-color: var(--primary-light);
        }
        
        .checkbox-icon {
          width: 14px;
          height: 14px;
          color: white;
        }
        
        :global(.checkbox-icon) {
          width: 14px !important;
          height: 14px !important;
          color: white !important;
        }
        
        .event-content {
          flex: 1;
        }
        
        .event-title {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--foreground);
          cursor: pointer;
        }
        
        :global(.dark) .event-title {
          color: white;
        }
        
        .event-details {
          font-size: 0.875rem;
          color: var(--foreground);
          opacity: 0.8;
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
          background-color: var(--primary);
          color: white;
          font-size: 0.75rem;
          padding: 0.125rem 0.375rem;
          border-radius: 9999px;
          margin-bottom: 0.25rem;
        }
        
        :global(.dark) .event-badge {
          background-color: var(--primary-light);
        }
        
        .event-edit-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background-color: rgba(var(--primary-rgb), 0.1);
          color: var(--primary);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
          margin-left: 0.5rem;
        }
        
        :global(.dark) .event-edit-button {
          background-color: rgba(var(--primary-rgb), 0.25);
          color: var(--primary-light);
        }
        
        .event-edit-button:hover {
          background-color: var(--primary);
          color: white;
        }
        
        :global(.dark) .event-edit-button:hover {
          background-color: var(--primary-light);
          color: var(--background);
        }
        
        :global(.edit-icon) {
          width: 18px !important;
          height: 18px !important;
        }
        
        .event-list-footer {
          padding: 1.25rem;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          align-items: center;
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
          background-color: var(--primary);
          color: white;
          border: none;
          border-radius: var(--radius);
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          max-width: 300px;
        }
        
        :global(.dark) .add-to-calendar-button {
          background-color: var(--primary-light);
        }
        
        .add-to-calendar-button:hover:not(:disabled) {
          background-color: var(--primary-dark);
        }
        
        :global(.dark) .add-to-calendar-button:hover:not(:disabled) {
          background-color: var(--primary);
        }
        
        .add-to-calendar-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .auth-message {
          margin-top: 0.75rem;
          font-size: 0.875rem;
          color: var(--foreground);
          opacity: 0.7;
          text-align: center;
        }
        
        :global(.dark) .auth-message {
          color: rgba(255, 255, 255, 0.7);
        }
        
        .calendar-container {
          height: 500px;
          padding: 1rem;
        }
        
        /* Editor styles */
        .event-editor-container {
          position: fixed;
          background-color: var(--card);
          border-radius: var(--radius);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          z-index: 100;
          overflow: hidden;
          resize: both;
          display: flex;
          flex-direction: column;
          min-width: 400px;
          min-height: 600px;
          max-width: 90vw;
          max-height: 90vh;
        }
        
        .editor-drag-handle {
          padding: 0.75rem 1rem;
          background-color: var(--card);
          border-bottom: 1px solid var(--border);
          cursor: move;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          user-select: none;
          background: linear-gradient(to right, rgba(var(--primary-rgb), 0.05), rgba(var(--primary-rgb), 0.1));
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
          background-color: rgba(0, 0, 0, 0.1);
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--foreground);
          position: relative;
        }
        
        :global(.close-icon) {
          width: 18px !important;
          height: 18px !important;
          color: var(--foreground) !important;
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
      `}</style>
    </div>
  );
} 