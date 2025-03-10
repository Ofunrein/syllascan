'use client';

import { useState, useEffect } from 'react';
import { getFirebaseClientAuth } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

export default function FirebaseAuthTest() {
  const [authStatus, setAuthStatus] = useState<string>('Checking authentication...');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const auth = getFirebaseClientAuth();
    if (!auth) {
      setAuthStatus('Firebase Auth not initialized');
      return;
    }

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, 
      (user) => {
        if (user) {
          setUser(user);
          setAuthStatus('User is signed in');
        } else {
          setUser(null);
          setAuthStatus('No user signed in');
        }
      },
      (error) => {
        console.error('Auth state change error:', error);
        setError(error.message);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleAnonymousSignIn = async () => {
    try {
      setError(null);
      const auth = getFirebaseClientAuth();
      if (!auth) {
        setError('Firebase Auth not initialized');
        return;
      }
      
      const result = await signInAnonymously(auth);
      console.log('Anonymous sign in successful:', result.user);
    } catch (error: any) {
      console.error('Error signing in anonymously:', error);
      setError(error.message);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Firebase Authentication Test</h2>
      
      <div className="mb-4">
        <p><strong>Status:</strong> {authStatus}</p>
        {error && (
          <p className="text-red-500 mt-2">
            <strong>Error:</strong> {error}
          </p>
        )}
      </div>
      
      {user && (
        <div className="mb-4 p-3 bg-gray-100 rounded">
          <h3 className="font-medium">User Info:</h3>
          <p>UID: {user.uid}</p>
          <p>Anonymous: {user.isAnonymous ? 'Yes' : 'No'}</p>
          {user.email && <p>Email: {user.email}</p>}
        </div>
      )}
      
      <div className="flex gap-2">
        <button
          onClick={handleAnonymousSignIn}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          Sign In Anonymously
        </button>
      </div>
    </div>
  );
} 