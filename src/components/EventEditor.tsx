import { useState, useEffect } from 'react';
import { Event } from '@/lib/openai';
import { format, parseISO } from 'date-fns';
import { PaperAirplaneIcon, XMarkIcon, CalendarIcon, MapPinIcon, ClockIcon, DocumentTextIcon, PencilIcon, SparklesIcon, CheckIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

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
  const [activeTab, setActiveTab] = useState<'form' | 'ai'>('form');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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
      {/* Tab Navigation */}
      <div className="editor-tabs">
        <button
          className={`editor-tab ${activeTab === 'form' ? 'active' : ''}`}
          onClick={() => setActiveTab('form')}
        >
          <div className="tab-icon-container">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="editor-tab-icon">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </div>
          <span>Edit Form</span>
        </button>
        <button
          className={`editor-tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          <div className="tab-icon-container">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="editor-tab-icon">
              <path d="M15 2l5 5L8 19l-5-5L15 2z"></path>
              <path d="M18 13l2 2-2 2-2-2 2-2z"></path>
              <path d="M6 17l2 2-2 2-2-2 2-2z"></path>
              <path d="M14 8l2-2-2-2-2 2 2 2z"></path>
            </svg>
          </div>
          <span>AI Assistant</span>
        </button>
      </div>

      {/* Content area - takes remaining height */}
      <div className="editor-content">
        {activeTab === 'form' ? (
          <form onSubmit={handleSubmit} className="event-form">
            <div className="form-scrollable-content">
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
                  <DocumentTextIcon className="form-label-icon" />
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
                  <MapPinIcon className="form-label-icon" />
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
                  <ClockIcon className="form-label-icon" />
                  <span>All day event</span>
              </label>
            </div>
            
              <div className="form-field-group">
                <div className="form-field">
                  <label htmlFor="startDate" className="form-label">
                    <CalendarIcon className="form-label-icon" />
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
                      <ClockIcon className="form-label-icon" />
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
                    <CalendarIcon className="form-label-icon" />
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
                      <ClockIcon className="form-label-icon" />
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
                type="submit"
                className="form-button-primary"
              >
                <CheckIcon className="button-icon" />
                <span>{getButtonText()}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="ai-assistant-wrapper">
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
            
            <div className="form-actions ai-actions">
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
                onClick={handleSubmit}
                className="form-button-primary"
              >
                <CheckIcon className="button-icon" />
                <span>{getButtonText()}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .event-editor-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        
        .editor-tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(to right, rgba(var(--primary-rgb), 0.05), rgba(var(--primary-rgb), 0.1));
          flex-shrink: 0;
          padding: 0.5rem 0.5rem 0;
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
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .form-field {
          margin-bottom: 1rem;
        }
        
        .form-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: var(--foreground);
        }
        
        .form-label-icon {
          width: 1rem;
          height: 1rem;
          color: var(--primary);
        }
        
        .form-input-wrapper {
          position: relative;
        }
        
        .form-input {
          width: 100%;
          padding: 0.625rem;
          border: 1px solid var(--border);
          border-radius: 0.375rem;
          background-color: var(--background);
          color: var(--foreground);
          font-size: 0.875rem;
          transition: all 0.2s;
        }
        
        .form-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
        }
        
        .form-field-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
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
        }
        
        .form-field-group {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .form-actions {
          display: flex;
          justify-content: space-between;
          padding: 1rem;
          border-top: 1px solid var(--border);
          background-color: rgba(var(--primary-rgb), 0.05);
          flex-shrink: 0;
        }
        
        .form-button-primary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1.25rem;
          background-color: var(--primary);
          color: white;
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
          padding: 0.5rem 1.25rem;
          background-color: transparent;
          color: var(--foreground);
          border: 1px solid var(--border);
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
          height: 100%;
        }
        
        .ai-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .chat-message {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }
        
        .chat-message.user {
          align-items: flex-start;
        }
        
        .chat-bubble {
          max-width: 80%;
          padding: 0.75rem 1rem;
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
          font-size: 0.875rem;
          line-height: 1.5;
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
          padding: 0.75rem;
          border-top: 1px solid var(--border);
          background-color: rgba(var(--primary-rgb), 0.03);
        }
        
        .ai-chat-form {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        
        .ai-chat-input {
          flex: 1;
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 1.5rem;
          background-color: var(--background);
          color: var(--foreground);
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
          padding: 0.5rem 1rem;
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
          padding: 0.75rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--foreground);
          opacity: 0.7;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          position: relative;
          bottom: -1px;
        }
        
        .tab-icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.5rem;
          background-color: rgba(var(--primary-rgb), 0.1);
          transition: all 0.2s ease;
        }
        
        .editor-tab-icon {
          width: 1.25rem;
          height: 1.25rem;
          color: var(--primary);
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
          border-bottom-color: var(--primary);
          background-color: var(--card);
          border-bottom: none;
          box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.05);
        }
        
        .editor-tab.active .tab-icon-container {
          background-color: var(--primary);
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
      `}</style>
    </div>
  );
} 