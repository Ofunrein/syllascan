import { useState } from 'react';
import { XCircleIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

export default function CalendarAuthBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleClose = () => {
    setIsVisible(false);
  };

  const handleReconnect = async () => {
    try {
      setIsConnecting(true);
      toast.loading('Connecting to Google Calendar...');
      
      // Get the authorization URL from the server
      const response = await fetch('/api/auth/google-url?prompt=select_account&state=calendar', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get authorization URL');
      }
      
      const { url } = await response.json();
      
      // Redirect to Google's OAuth page
      window.location.href = url;
    } catch (error) {
      console.error('Error reconnecting to Google Calendar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reconnect to Google Calendar';
      toast.error(errorMessage);
      setIsConnecting(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
      <div className="p-4 flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Google Calendar authorization expired
              </h3>
            </div>
          </div>
          <button
            type="button"
            className="ml-auto bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
            onClick={handleClose}
          >
            <span className="sr-only">Close</span>
            <XCircleIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your connection to Google Calendar has expired. Please reconnect to continue using calendar features.
          </p>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleReconnect}
            disabled={isConnecting}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              'Reconnect to Google Calendar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 