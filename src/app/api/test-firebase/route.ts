import { NextResponse } from 'next/server';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';

export async function GET() {
  try {
    // Hardcoded Firebase config for testing
    const firebaseConfig = {
      apiKey: "AIzaSyABWt_6s4oNnXulsWsESuTq6tHBjV09_9M",
      authDomain: "gcalocr-fad0a.firebaseapp.com",
      projectId: "gcalocr-fad0a",
      storageBucket: "gcalocr-fad0a.appspot.com",
      messagingSenderId: "313051630574",
      appId: "1:313051630574:web:6432348a7318d440251cff"
    };

    // Log the config for debugging
    console.log("Firebase config:", firebaseConfig);

    // Initialize Firebase
    const app = initializeApp(firebaseConfig, 'test-app');
    const auth = getAuth(app);

    // Try to sign in anonymously to test the API key
    try {
      const userCredential = await signInAnonymously(auth);
      return NextResponse.json({ 
        success: true, 
        message: "Firebase initialized successfully",
        user: userCredential.user.uid
      });
    } catch (authError) {
      console.error("Firebase auth error:", authError);
      return NextResponse.json({ 
        success: false, 
        message: "Firebase auth error", 
        error: authError.toString() 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Firebase initialization error:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Firebase initialization error", 
      error: error.toString() 
    }, { status: 500 });
  }
} 