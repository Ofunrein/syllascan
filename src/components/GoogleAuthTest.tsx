'use client';

import { useState } from 'react';

export default function GoogleAuthTest() {
  const [status, setStatus] = useState<string>('Not authenticated');
  const [error, setError] = useState<string | null>(null);

  const handleGoogleAuth = async () => {
    try {
      setError(null);
      setStatus('Initiating Google authentication...');
      
      // Get the authorization URL from the server
      const response = await fetch('/api/auth/google-url?state=test', {
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
      console.log('Received Google auth URL, redirecting...');
      
      // Redirect to Google's OAuth page
      window.location.href = url;
    } catch (error: any) {
      console.error('Error initiating Google authentication:', error);
      setError(error.message || 'An error occurred');
      setStatus('Authentication failed');
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Google OAuth Test</h2>
      
      <div className="mb-4">
        <p><strong>Status:</strong> {status}</p>
        {error && (
          <p className="text-red-500 mt-2">
            <strong>Error:</strong> {error}
          </p>
        )}
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleGoogleAuth}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          Authenticate with Google
        </button>
      </div>
    </div>
  );
} 