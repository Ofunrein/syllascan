import { useState, useEffect } from 'react';
import { useUser } from '@/lib/UserContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  DocumentTextIcon, 
  DocumentIcon, 
  PhotoIcon, 
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

type ProcessingRecord = {
  id: string;
  fileName: string;
  fileType: string;
  eventCount: number;
  processingDate: string;
  status: 'success' | 'failed' | 'partial';
};

// Mock data for development
const mockHistory: ProcessingRecord[] = [
  {
    id: '1',
    fileName: 'syllabus_spring2023.pdf',
    fileType: 'application/pdf',
    eventCount: 12,
    processingDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    status: 'success'
  },
  {
    id: '2',
    fileName: 'class_schedule.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    eventCount: 8,
    processingDate: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    status: 'partial'
  },
  {
    id: '3',
    fileName: 'exam_dates.jpg',
    fileType: 'image/jpeg',
    eventCount: 4,
    processingDate: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
    status: 'success'
  }
];

export default function ProcessingHistory() {
  const [history, setHistory] = useState<ProcessingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, accessToken } = useUser();

  const fetchHistory = async () => {
    setIsLoading(true);
    
    try {
      // For development, use mock data instead of making an API call
      // This ensures we don't show a loading spinner forever
      setTimeout(() => {
        setHistory(mockHistory);
        setIsLoading(false);
      }, 1000);
      
      // Commented out actual API call for now
      /*
      if (!accessToken) return;
      
      const response = await fetch('/api/history', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch processing history');
      }

      const data = await response.json();
      setHistory(data.records || []);
      */
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load processing history');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch history on component mount, regardless of accessToken
    fetchHistory();
  }, []);

  const handleDelete = async (id: string) => {
    // For development, just update the local state
    setHistory(history.filter(record => record.id !== id));
    toast.success('Record deleted successfully');
    
    // Commented out actual API call for now
    /*
    if (!accessToken) return;
    
    try {
      const response = await fetch(`/api/history/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete record');
      }

      // Update the local state
      setHistory(history.filter(record => record.id !== id));
      toast.success('Record deleted successfully');
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error('Failed to delete record');
    }
    */
  };

  const getFileIcon = (fileType: string, fileName: string) => {
    const lowerFileType = fileType.toLowerCase();
    const lowerFileName = fileName.toLowerCase();
    
    if (lowerFileType.includes('pdf') || lowerFileName.endsWith('.pdf')) {
      return (
        <div className="file-icon-wrapper pdf">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="file-icon">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
      );
    } else if (lowerFileType.includes('word') || lowerFileName.endsWith('.doc') || lowerFileName.endsWith('.docx')) {
      return (
        <div className="file-icon-wrapper doc">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="file-icon">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </div>
      );
    } else if (lowerFileType.startsWith('image/') || lowerFileName.endsWith('.jpg') || lowerFileName.endsWith('.jpeg') || lowerFileName.endsWith('.png') || lowerFileName.endsWith('.gif')) {
      return (
        <div className="file-icon-wrapper img">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="file-icon">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>
      );
    }
    
    return (
      <div className="file-icon-wrapper default">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="file-icon">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (error) {
      return dateString;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="status-icon success">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        );
      case 'failed':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="status-icon failed">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        );
      case 'partial':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="status-icon partial">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="px-4 py-5 sm:px-6 text-center">
        <p className="text-gray-500">No processing history found</p>
      </div>
    );
  }

  return (
    <div className="processing-history">
      <div className="history-header">
        <div className="header-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="header-svg">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <path d="M2 10h20" />
            <path d="M8 14h.01" />
            <path d="M12 14h.01" />
            <path d="M16 14h.01" />
            <path d="M8 18h.01" />
            <path d="M12 18h.01" />
            <path d="M16 18h.01" />
          </svg>
        </div>
        <div className="header-text">
          <h2 className="header-title">Processing History</h2>
          <p className="header-subtitle">Your recent document uploads and event extractions</p>
        </div>
      </div>
      
      <ul className="history-list">
        {history.map((record) => (
          <li key={record.id} className="history-item">
            <div className="item-color-indicator" style={{ backgroundColor: getFileColorIndicator(record.fileType, record.fileName) }}></div>
            <div className="item-content">
              <div className="item-name">{record.fileName}</div>
              <div className="item-details">
                <span className="item-date">{formatDate(record.processingDate)}</span>
                <span className={`item-status ${record.status}`}>
                  {record.status === 'success' ? 'Success' : record.status === 'failed' ? 'Failed' : 'Partial'}
                </span>
              </div>
            </div>
            <div className="item-events">
              <span className="events-count">{record.eventCount} events</span>
            </div>
          </li>
        ))}
      </ul>
      
      <style jsx>{`
        .processing-history {
          background-color: var(--card);
          border-radius: 0.75rem;
          overflow: hidden;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        }
        
        .history-header {
          padding: 1.5rem;
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--border);
        }
        
        .header-icon {
          width: 3rem;
          height: 3rem;
          background-color: #f3f4f6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 1rem;
        }
        
        .header-svg {
          width: 1.5rem;
          height: 1.5rem;
          color: #6b7280;
        }
        
        .header-text {
          flex: 1;
        }
        
        .header-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--foreground);
          margin: 0;
          line-height: 1.2;
        }
        
        .header-subtitle {
          font-size: 1rem;
          color: #6b7280;
          margin: 0.25rem 0 0 0;
        }
        
        .history-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .history-item {
          display: flex;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border);
          transition: background-color 0.2s;
        }
        
        .history-item:last-child {
          border-bottom: none;
        }
        
        .history-item:hover {
          background-color: rgba(0, 0, 0, 0.02);
        }
        
        .item-color-indicator {
          width: 1rem;
          height: 1rem;
          border-radius: 50%;
          margin-right: 1rem;
        }
        
        .item-content {
          flex: 1;
        }
        
        .item-name {
          font-size: 1rem;
          font-weight: 500;
          color: var(--foreground);
          margin-bottom: 0.25rem;
        }
        
        .item-details {
          display: flex;
          align-items: center;
          font-size: 0.875rem;
          color: #6b7280;
        }
        
        .item-date {
          margin-right: 0.75rem;
        }
        
        .item-status {
          font-size: 0.75rem;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
        }
        
        .item-status.success {
          background-color: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }
        
        .item-status.failed {
          background-color: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
        
        .item-status.partial {
          background-color: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }
        
        .item-events {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          margin-left: 1rem;
        }
        
        .events-count {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--foreground);
          margin-bottom: 0.25rem;
        }
        
        .primary-badge {
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          background-color: #e0e7ff;
          color: #4f46e5;
          border-radius: 1rem;
        }
        
        :global(.dark) .header-icon {
          background-color: rgba(255, 255, 255, 0.1);
        }
        
        :global(.dark) .header-svg {
          color: rgba(255, 255, 255, 0.7);
        }
        
        :global(.dark) .header-subtitle {
          color: rgba(255, 255, 255, 0.7);
        }
        
        :global(.dark) .item-details {
          color: rgba(255, 255, 255, 0.7);
        }
        
        :global(.dark) .history-item:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}

function getFileColorIndicator(fileType: string, fileName: string) {
  const lowerFileType = fileType.toLowerCase();
  const lowerFileName = fileName.toLowerCase();
  
  if (lowerFileType.includes('pdf') || lowerFileName.endsWith('.pdf')) {
    return '#ef4444'; // Red
  } else if (lowerFileType.includes('word') || lowerFileName.endsWith('.doc') || lowerFileName.endsWith('.docx')) {
    return '#3b82f6'; // Blue
  } else if (lowerFileType.startsWith('image/') || lowerFileName.endsWith('.jpg') || lowerFileName.endsWith('.jpeg') || lowerFileName.endsWith('.png') || lowerFileName.endsWith('.gif')) {
    return '#10b981'; // Green
  }
  
  return '#6b7280'; // Gray
} 