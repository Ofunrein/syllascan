import { useState, useEffect } from 'react';
import { Event } from '@/lib/openai';
import { format, parseISO } from 'date-fns';
import { PaperAirplaneIcon, CalendarIcon, MapPinIcon, ClockIcon, DocumentTextIcon, CheckIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

// Enum for editor mode - must match the one in EventList.tsx
enum EditorMode {
  Add = 'add',
  Edit = 'edit'
}

interface EventEditorProps {
  event: Event;
  onSave: (updatedEvent: Event) => void;
  onCancel: () => void;
  mode: EditorMode;
}

export default function EventEditor({ event, onSave, onCancel, mode }: EventEditorProps) {
  const [eventTitle, setEventTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || '');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState(event.location || '');
  const [isAllDay, setIsAllDay] = useState(event.isAllDay || false);
  
  // Chat interface state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    {role: 'assistant', content: 'How would you like to modify this event? You can say things like "Change the title to Workshop on AI" or "Move the event to next Monday at 2pm".'}
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Parse ISO dates into date and time components for the form
  useEffect(() => {
    try {
      const start = parseISO(event.startDate);
      setStartDate(format(start, 'yyyy-MM-dd'));
      setStartTime(format(start, 'HH:mm'));

      if (event.endDate) {
        const end = parseISO(event.endDate);
        setEndDate(format(end, 'yyyy-MM-dd'));
        setEndTime(format(end, 'HH:mm'));
      } else {
        // Default end date to start date if not provided
        setEndDate(format(start, 'yyyy-MM-dd'));
        setEndTime(format(start, 'HH:mm'));
      }
    } catch (error) {
      console.error('Error parsing dates:', error);
      // Handle invalid dates gracefully
    }
  }, [event]);

  const saveEventFromFields = () => {
    // Combine date and time into ISO strings
    let formattedStartDate = startDate;
    let formattedEndDate = endDate || startDate;
    
    if (!isAllDay) {
      formattedStartDate = `${startDate}T${startTime}:00`;
      formattedEndDate = `${endDate || startDate}T${endTime || startTime}:00`;
    } else {
      // For all-day events, we don't include time
      formattedStartDate = `${startDate}T00:00:00`;
      formattedEndDate = `${endDate || startDate}T23:59:59`;
    }

    const updatedEvent: Event = {
      ...event,
      title: eventTitle,
      description: description || undefined,
      startDate: formattedStartDate,
      endDate: formattedEndDate !== formattedStartDate ? formattedEndDate : undefined,
      location: location || undefined,
      isAllDay,
    };

    onSave(updatedEvent);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chatInput.trim()) return;
    
    // Add user message to chat
    const userMessage = { role: 'user' as const, content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);
    
    try {
      // Get current event state
      const currentEvent = {
        title: eventTitle,
        description,
        startDate: isAllDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`,
        endDate: isAllDay ? `${endDate}T23:59:59` : `${endDate}T${endTime}:00`,
        location,
        isAllDay
      };
      
      // Send request to API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: chatInput,
          event: currentEvent
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }
      
      const data = await response.json();
      
      // Add AI response to chat
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      
      // Update event fields if AI suggested changes
      if (data.updatedEvent) {
        if (data.updatedEvent.title) setEventTitle(data.updatedEvent.title);
        if (data.updatedEvent.description) setDescription(data.updatedEvent.description);
        if (data.updatedEvent.location) setLocation(data.updatedEvent.location);
        if (data.updatedEvent.isAllDay !== undefined) setIsAllDay(data.updatedEvent.isAllDay);
        
        // Handle date updates
        if (data.updatedEvent.startDate) {
          try {
            const start = parseISO(data.updatedEvent.startDate);
            setStartDate(format(start, 'yyyy-MM-dd'));
            if (!isAllDay) setStartTime(format(start, 'HH:mm'));
          } catch (error) {
            console.error('Error parsing start date:', error);
          }
        }
        
        if (data.updatedEvent.endDate) {
          try {
            const end = parseISO(data.updatedEvent.endDate);
            setEndDate(format(end, 'yyyy-MM-dd'));
            if (!isAllDay) setEndTime(format(end, 'HH:mm'));
          } catch (error) {
            console.error('Error parsing end date:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error in AI chat:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error while processing your request. Please try again.' 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Get the appropriate button text based on the mode
  const getButtonText = () => {
    return mode === EditorMode.Add ? 'Add Event' : 'Save';
  };

  return (
    <div className="event-editor-wrapper">
      <div className="editor-content">
        <div className="event-form">
          <div className="form-scrollable-content">
            <section className="manual-edit-section">
              <div className="section-heading">
                <span>Manual edit</span>
                <small>Change the event details directly.</small>
              </div>

              <div className="form-field">
                <label htmlFor="title" className="form-label">
                  <span className="form-label-text">Title *</span>
              </label>
                <div className="form-input-wrapper">
              <input
                type="text"
                id="title"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                required
                    className="form-input"
                    placeholder="Event title"
              />
                </div>
            </div>
            
              <div className="form-field">
                <label htmlFor="description" className="form-label">
                  <DocumentTextIcon className="form-label-icon h-4 w-4 shrink-0" />
                  <span className="form-label-text">Description</span>
              </label>
                <div className="form-input-wrapper">
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="form-input"
                    placeholder="Event description"
              />
                </div>
            </div>
            
              <div className="form-field">
                <label htmlFor="location" className="form-label">
                  <MapPinIcon className="form-label-icon h-4 w-4 shrink-0" />
                  <span className="form-label-text">Location</span>
              </label>
                <div className="form-input-wrapper">
              <input
                type="text"
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                    className="form-input"
                    placeholder="Event location"
              />
                </div>
            </div>
            
              <div className="form-field-checkbox">
              <input
                type="checkbox"
                id="isAllDay"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
                  className="form-checkbox"
              />
                <label htmlFor="isAllDay" className="form-checkbox-label">
                  <ClockIcon className="form-label-icon h-4 w-4 shrink-0" />
                  <span>All day event</span>
              </label>
            </div>
            
              <div className="form-field-group">
                <div className="form-field">
                  <label htmlFor="startDate" className="form-label">
                    <CalendarIcon className="form-label-icon h-4 w-4 shrink-0" />
                    <span className="form-label-text">Start Date *</span>
                </label>
                  <div className="form-input-wrapper">
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                      className="form-input"
                />
                  </div>
              </div>
              
              {!isAllDay && (
                  <div className="form-field">
                    <label htmlFor="startTime" className="form-label">
                      <ClockIcon className="form-label-icon h-4 w-4 shrink-0" />
                      <span className="form-label-text">Start Time *</span>
                  </label>
                    <div className="form-input-wrapper">
                  <input
                    type="time"
                    id="startTime"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                        className="form-input"
                  />
                    </div>
                </div>
              )}
                
                <div className="form-field">
                  <label htmlFor="endDate" className="form-label">
                    <CalendarIcon className="form-label-icon h-4 w-4 shrink-0" />
                    <span className="form-label-text">End Date</span>
                </label>
                  <div className="form-input-wrapper">
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                      className="form-input"
                />
                  </div>
              </div>
              
              {!isAllDay && (
                  <div className="form-field">
                    <label htmlFor="endTime" className="form-label">
                      <ClockIcon className="form-label-icon h-4 w-4 shrink-0" />
                      <span className="form-label-text">End Time</span>
                  </label>
                    <div className="form-input-wrapper">
                  <input
                    type="time"
                    id="endTime"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                        className="form-input"
                  />
                    </div>
                </div>
              )}
              </div>
            </section>

            <section className="ai-assistant-wrapper">
              <div className="section-heading">
                <span>AI assistant</span>
                <small>Ask for natural-language edits, then save once.</small>
              </div>
              <div className="ai-chat-messages">
                {chatMessages.map((message, index) => (
                  <div
                  key={index}
                  className={`chat-message ${message.role === 'user' ? 'user' : 'assistant'}`}
                >
                  <div className="chat-bubble">
                    <p className="chat-text">{message.content}</p>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="chat-message assistant">
                  <div className="chat-bubble">
                    <div className="typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="ai-chat-input-container">
              <form onSubmit={handleChatSubmit} className="ai-chat-form">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask the AI assistant to help modify this event..."
                  className="ai-chat-input"
                disabled={isChatLoading}
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatInput.trim()}
                  className="ai-chat-send-button"
                  aria-label="Send message"
                >
                  <PaperAirplaneIcon className="ai-chat-send-icon" />
                  <span className="send-text">Send</span>
                </button>
              </form>
            </div>
            </section>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onCancel}
              className="form-button-secondary"
            >
              <ArrowLeftIcon className="button-icon" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={saveEventFromFields}
              className="form-button-primary"
            >
              <CheckIcon className="button-icon" />
              <span>{getButtonText()}</span>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .event-editor-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          color: white;
        }
        
        .editor-tabs {
          display: flex;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background-color: rgba(255, 255, 255, 0.04);
          flex-shrink: 0;
          padding: 0.45rem;
          gap: 0.35rem;
        }
        
        .editor-content {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .event-form {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        
        .form-scrollable-content {
          flex: 1;
          overflow-y: auto;
          padding: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          min-height: 0;
        }

        .manual-edit-section,
        .ai-assistant-wrapper {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.85rem;
          background: rgba(255, 255, 255, 0.035);
        }

        .manual-edit-section {
          padding: 0.8rem;
        }

        .section-heading {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .section-heading span {
          color: white;
          font-size: 0.9rem;
          font-weight: 750;
        }

        .section-heading small {
          color: rgba(255, 255, 255, 0.45);
          font-size: 0.72rem;
          text-align: right;
        }
        
        .form-field {
          margin-bottom: 0;
        }
        
        .form-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.4rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.86);
          font-size: 0.82rem;
        }
        
        .form-label-icon {
          width: 1rem !important;
          height: 1rem !important;
          color: rgba(255, 255, 255, 0.62);
          flex-shrink: 0;
        }
        
        .form-input-wrapper {
          position: relative;
        }
        
        .form-input {
          width: 100%;
          padding: 0.58rem 0.7rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 0.55rem;
          background-color: rgba(8, 10, 18, 0.72);
          color: white;
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .form-input::placeholder {
          color: rgba(255, 255, 255, 0.38);
        }
        
        .form-input:focus {
          outline: none;
          border-color: rgba(147, 197, 253, 0.7);
          box-shadow: 0 0 0 2px rgba(147, 197, 253, 0.16);
        }
        
        .form-field-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0.1rem 0;
        }
        
        .form-checkbox {
          width: 1rem;
          height: 1rem;
          border-radius: 0.25rem;
          border: 1px solid var(--border);
          background-color: var(--background);
          cursor: pointer;
        }
        
        .form-checkbox:checked {
          background-color: var(--primary);
          border-color: var(--primary);
        }
        
        .form-checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.86);
        }
        
        .form-field-group {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
          margin-bottom: 0;
        }
        
        .form-actions {
          display: flex;
          justify-content: space-between;
          padding: 0.7rem 0.85rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background-color: rgba(8, 10, 18, 0.72);
          flex-shrink: 0;
        }
        
        .form-button-primary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.58rem 1.05rem;
          background-color: rgba(147, 197, 253, 0.95);
          color: #08111f;
          border: none;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .form-button-primary:hover {
          background-color: var(--primary-dark);
        }
        
        :global(.dark) .form-button-primary {
          background-color: var(--primary-light);
        }
        
        :global(.dark) .form-button-primary:hover {
          background-color: var(--primary);
        }
        
        .form-button-secondary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.58rem 1.05rem;
          background-color: transparent;
          color: rgba(255, 255, 255, 0.86);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .form-button-secondary:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
        
        .button-icon {
          width: 1rem;
          height: 1rem;
        }
        
        .ai-assistant-wrapper {
          display: flex;
          flex-direction: column;
          min-height: 12rem;
          max-height: min(32dvh, 18rem);
          overflow: hidden;
          padding-top: 0.8rem;
        }
        
        .ai-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 0 0.8rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          min-height: 0;
        }
        
        .chat-message {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          margin-bottom: 0;
        }
        
        .chat-message.user {
          align-items: flex-start;
        }
        
        .chat-bubble {
          max-width: 80%;
          padding: 0.58rem 0.72rem;
          border-radius: 1rem;
          background-color: rgba(var(--primary-rgb), 0.1);
          color: var(--foreground);
        }
        
        .chat-message.user .chat-bubble {
          background-color: rgba(var(--primary-rgb), 0.2);
          color: var(--foreground);
          border-bottom-left-radius: 0.25rem;
        }
        
        .chat-message.assistant .chat-bubble {
          background-color: rgba(var(--primary-rgb), 0.1);
          color: var(--foreground);
          border-bottom-left-radius: 0.25rem;
        }
        
        .chat-text {
          margin: 0;
          font-size: 0.8rem;
          line-height: 1.35;
        }
        
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        
        .typing-indicator span {
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 50%;
          background-color: var(--foreground);
          opacity: 0.6;
          animation: typing 1s infinite ease-in-out;
        }
        
        .typing-indicator span:nth-child(1) {
          animation-delay: 0s;
        }
        
        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes typing {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        
        .ai-chat-input-container {
          padding: 0.65rem 0.8rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background-color: rgba(8, 10, 18, 0.72);
        }
        
        .ai-chat-form {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        
        .ai-chat-input {
          flex: 1;
          padding: 0.55rem 0.7rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 1.5rem;
          background-color: rgba(8, 10, 18, 0.72);
          color: white;
          font-size: 0.875rem;
        }
        
        .ai-chat-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
        }
        
        .ai-chat-send-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 0.8rem;
          border-radius: 1.5rem;
          background-color: var(--primary);
          color: white;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          gap: 0.25rem;
        }
        
        .ai-chat-send-button:hover:not(:disabled) {
          background-color: var(--primary-dark);
        }
        
        .ai-chat-send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .ai-chat-send-icon {
          width: 1rem;
          height: 1rem;
          transform: rotate(45deg);
        }
        
        .send-text {
          font-size: 0.875rem;
          font-weight: 500;
        }
        
        .editor-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.7rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.76);
          opacity: 0.7;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          border-radius: 0.65rem;
          position: relative;
          bottom: -1px;
        }
        
        .tab-icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: 0.5rem;
          background-color: rgba(147, 197, 253, 0.12);
          transition: all 0.2s ease;
        }
        
        .editor-tab-icon {
          width: 1rem;
          height: 1rem;
          color: rgba(147, 197, 253, 0.9);
          transition: all 0.2s ease;
        }
        
        .editor-tab:hover {
          opacity: 0.9;
        }
        
        .editor-tab:hover .tab-icon-container {
          background-color: rgba(var(--primary-rgb), 0.15);
        }
        
        .editor-tab.active {
          opacity: 1;
          background-color: rgba(255, 255, 255, 0.1);
          border-bottom: none;
          box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.05);
        }
        
        .editor-tab.active .tab-icon-container {
          background-color: rgba(147, 197, 253, 0.95);
        }
        
        .editor-tab.active .editor-tab-icon {
          color: white;
        }
        
        :global(.dark) .editor-tab.active {
          background-color: var(--card);
        }
        
        :global(.dark) .editor-tab.active .tab-icon-container {
          background-color: var(--primary-light);
        }

        @media (max-width: 640px) {
          .editor-tabs {
            padding: 0.35rem;
          }

          .editor-tab {
            flex: 1;
            justify-content: center;
            padding: 0.45rem 0.35rem;
            font-size: 0.78rem;
          }

          .tab-icon-container {
            width: 1.75rem;
            height: 1.75rem;
          }

          .form-field-group {
            grid-template-columns: 1fr;
          }

          .form-actions {
            gap: 0.6rem;
          }

          .form-button-primary,
          .form-button-secondary {
            flex: 1;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
} 
