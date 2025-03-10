import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import firebaseConfig from '@/lib/firebase-config';

export default function FirebaseTest() {
  const [status, setStatus] = useState<string>('Testing Firebase...');
  const [error, setError] = useState<string | null>(null);
  const [showComponent, setShowComponent] = useState<boolean>(true);

  useEffect(() => {
    const testFirebase = async () => {
      try {
        console.log("Firebase config loaded:", { 
          projectId: firebaseConfig.projectId,
          authDomain: firebaseConfig.authDomain
        });
        
        // Initialize Firebase directly in this component
        const app = initializeApp(firebaseConfig, 'test-app');
        const auth = getAuth(app);
        
        setStatus('Firebase initialized successfully');
        
        // Hide component after successful initialization
        setTimeout(() => setShowComponent(false), 2000);
      } catch (error: any) {
        setStatus('Firebase initialization failed');
        setError(`Error: ${error.message}`);
        console.error('Firebase Init Error:', error);
      }
    };

    testFirebase();
  }, []);

  // Don't render anything if there's no need to show the component
  if (!showComponent) return null;

  // Only show minimal UI if there's an error, and log to console instead
  return (
    <div className="hidden">
      <h2 className="text-lg font-semibold mb-2">Firebase Configuration Test</h2>
      <p className="mb-2">{status}</p>
      {error && (
        <div className="hidden">
          <p className="font-medium">Error Details:</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
} 