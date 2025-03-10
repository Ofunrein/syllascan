'use client';

import { useState, useEffect } from 'react';

interface GoogleProfile {
  email: string;
  name: string;
  picture: string;
}

export default function GoogleUserProfile() {
  const [profile, setProfile] = useState<GoogleProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoogleProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/auth/google-profile', {
          credentials: 'include' // Include cookies in the request
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            // Not authenticated with Google, that's okay
            setProfile(null);
            setIsLoading(false);
            return;
          }
          
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to fetch Google profile');
        }
        
        const data = await response.json();
        setProfile(data);
      } catch (error: any) {
        console.error('Error fetching Google profile:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGoogleProfile();
  }, []);
  
  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse"></div>
        <div className="h-4 w-24 bg-gray-200 animate-pulse rounded"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-sm text-red-500">
        Error loading Google profile
      </div>
    );
  }
  
  if (!profile) {
    return null;
  }
  
  return (
    <div className="flex items-center space-x-2">
      {profile.picture ? (
        <img
          src={profile.picture}
          alt={profile.name || 'Google user'}
          className="h-8 w-8 rounded-full"
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
          {profile.name?.charAt(0) || profile.email?.charAt(0) || 'G'}
        </div>
      )}
      <div className="text-sm font-medium text-gray-700">
        {profile.name || profile.email}
      </div>
    </div>
  );
} 