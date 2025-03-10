import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  console.log('API Route - Environment Variables Check:');
  console.log('FIREBASE_ADMIN_PROJECT_ID:', process.env.FIREBASE_ADMIN_PROJECT_ID);
  console.log('FIREBASE_ADMIN_CLIENT_EMAIL:', process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
  console.log('FIREBASE_ADMIN_PRIVATE_KEY length:', process.env.FIREBASE_ADMIN_PRIVATE_KEY ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.length : 0);
  
  console.log("Session API route called");
  
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("Missing or invalid authorization header");
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    console.log("Got ID token, verifying...");
    
    try {
      // Get the Firebase Admin Auth instance
      const auth = getFirebaseAdminAuth();
      
      if (!auth) {
        console.error("Firebase Admin Auth is not initialized");
        return NextResponse.json(
          { error: 'Server Error', message: 'Firebase Admin Auth is not initialized' },
          { status: 500 }
        );
      }
      
      // Verify the Firebase ID token
      const decodedToken = await auth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      console.log("Token verified for user:", uid);

      // Return basic user info
      return NextResponse.json({ 
        uid,
        authenticated: true,
        message: 'Authentication successful'
      });
    } catch (authError: any) {
      console.error('Firebase Auth Error:', authError);
      return NextResponse.json(
        { 
          error: 'Auth Error', 
          code: authError.code || 'unknown',
          message: authError.message || 'Authentication failed'
        },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get session',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
} 