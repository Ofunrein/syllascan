import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { getFirebaseClientAuth, signInWithGoogle } from './firebase';
import toast from 'react-hot-toast';

interface UserContextType {
  user: User | null;
  loading: boolean;
  authenticated: boolean;
  googleAuthenticated: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  dismissErrors: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  authenticated: false,
  googleAuthenticated: false,
  signIn: async () => {},
  signOut: async () => {},
  dismissErrors: () => {},
});

export const useUser = () => useContext(UserContext);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [googleAuthenticated, setGoogleAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Set mounted state to true when component mounts on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Dismiss all error toasts
  const dismissErrors = () => {
    toast.dismiss();
    setLastError(null);
  };

  // Check if user has Google Calendar access token
  useEffect(() => {
    if (!mounted) return;
    
    // Check for Google Calendar authorization
    const checkGoogleAuth = () => {
      const hasAccessToken = document.cookie.includes('access_token');
      const hasGoogleAuth = document.cookie.includes('google_calendar_authorized');
      setGoogleAuthenticated(hasAccessToken || hasGoogleAuth);
    };
    
    // Check immediately
    checkGoogleAuth();
    
    // Check cookies every 2 seconds
    const interval = setInterval(checkGoogleAuth, 2000);
    
    return () => clearInterval(interval);
  }, [mounted]);

  // Listen for auth state changes
  useEffect(() => {
    if (!mounted) return;

    const auth = getFirebaseClientAuth();
    if (!auth) {
      console.error("Firebase auth not initialized");
      setLoading(false);
      return;
    }

    console.log("Setting up auth state listener...");
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log("Auth state changed:", user ? "User signed in" : "No user");
      setUser(user);
      
      // Simplify authentication - if we have a user, consider them authenticated
      setAuthenticated(!!user);
      setLoading(false);
    }, (error) => {
      console.error("Auth state change error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [mounted]);

  const signIn = async () => {
    if (!mounted) return;
    
    try {
      console.log("Attempting to sign in with Google...");
      const result = await signInWithGoogle();
      if (result && result.user) {
        toast.success(`Welcome, ${result.user.displayName || 'User'}!`);
        
        // Set googleAuthenticated to true immediately after successful sign-in
        // The cookies should have been set in the signInWithGoogle function
        setGoogleAuthenticated(true);
        
        // Show a success message about calendar access
        toast.success('Google Calendar access granted!', { 
          duration: 4000,
          icon: '📅'
        });
      }
    } catch (error: any) {
      console.error('Error signing in:', error);
      
      let errorMessage = 'Failed to sign in. Please try again later.';
      
      // Show a more user-friendly error message
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in was cancelled. Please try again.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Sign-in popup was blocked. Please allow popups for this site.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Sign-in request was cancelled. Please try again.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.code === 'auth/invalid-api-key') {
        errorMessage = 'Invalid API key. Please check your Firebase configuration.';
        console.error('Firebase API key error:', error);
      }
      
      setLastError(errorMessage);
      
      // Use a toastId to allow for programmatic dismissal
      toast.error(errorMessage, {
        id: 'auth-error',
        duration: 8000,
        icon: '❌',
      });
    }
  };

  const signOut = async () => {
    if (!mounted) return;
    
    const auth = getFirebaseClientAuth();
    if (auth) {
      try {
        console.log("Signing out...");
        await auth.signOut();
        
        // Clear all Google auth cookies
        document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "google_calendar_authorized=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        
        setUser(null);
        setAuthenticated(false);
        setGoogleAuthenticated(false);
        toast.success('Signed out successfully');
      } catch (error) {
        console.error('Error signing out:', error);
        const errorMessage = 'Failed to sign out. Please try again.';
        setLastError(errorMessage);
        toast.error(errorMessage, {
          id: 'signout-error',
          duration: 5000,
        });
      }
    }
  };

  // Render a consistent UI on both server and client
  return (
    <UserContext.Provider value={{ 
      user, 
      loading, 
      authenticated, 
      googleAuthenticated, 
      signIn, 
      signOut,
      dismissErrors 
    }}>
      {children}
    </UserContext.Provider>
  );
}; 