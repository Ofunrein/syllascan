import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import firebaseConfig from './firebase-config';

// Initialize Firebase
let app;
let auth;
let analytics;

// Only initialize on the client side
if (typeof window !== 'undefined') {
  try {
    // Initialize Firebase without a name to use the default app
    app = initializeApp(firebaseConfig);
    // Make sure to pass the app instance to getAuth()
    auth = getAuth(app);
    
    // Initialize analytics if available
    if (firebaseConfig.measurementId) {
      // Dynamically import analytics to avoid SSR issues
      import('firebase/analytics').then(({ getAnalytics }) => {
        analytics = getAnalytics(app);
        console.log("Firebase analytics initialized");
      }).catch(error => {
        console.error("Error initializing analytics:", error);
      });
    }
    
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
}

export const getFirebaseClientAuth = () => {
  return auth;
};

export const signInWithGoogle = async () => {
  if (!auth) {
    console.error("Firebase auth not initialized");
    return null;
  }
  
  const provider = new GoogleAuthProvider();
  
  // Add ALL necessary scopes for Google Calendar access
  provider.addScope('https://www.googleapis.com/auth/calendar');
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
  provider.addScope('https://www.googleapis.com/auth/calendar.settings.readonly');
  
  // Force account selection to avoid using the wrong account
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  
  try {
    console.log("Opening Google sign-in popup with calendar scopes...");
    const result = await signInWithPopup(auth, provider);
    
    // Store the access token in a cookie for API calls
    if (result.user && result._tokenResponse) {
      // Store the access token
      if (result._tokenResponse.oauthAccessToken) {
        document.cookie = `access_token=${result._tokenResponse.oauthAccessToken}; path=/; max-age=3600; SameSite=Lax`;
        console.log("Stored access_token in cookie");
      }
      
      // Store the refresh token if available
      if (result._tokenResponse.refreshToken) {
        document.cookie = `refresh_token=${result._tokenResponse.refreshToken}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
        console.log("Stored refresh_token in cookie");
      }
      
      // Set a flag indicating Google Calendar is authorized
      document.cookie = `google_calendar_authorized=true; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
    }
    
    return result;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error; // Re-throw to allow UserContext to handle the error
  }
}; 