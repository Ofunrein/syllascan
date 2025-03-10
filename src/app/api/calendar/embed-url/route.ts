import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from 'firebase-admin';
import { initAdmin } from '@/lib/firebase-admin';

// Initialize Firebase Admin
initAdmin();

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No valid authorization header' },
        { status: 401 }
      );
    }
    
    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No token provided' },
        { status: 401 }
      );
    }
    
    try {
      // Verify the Firebase ID token
      await auth().verifyIdToken(idToken);
      
      // For now, just return a simple embed URL for the primary calendar
      // In a real implementation, you would fetch the user's calendar ID from Google
      const embedUrl = 'https://calendar.google.com/calendar/embed?' + 
        'src=primary' +
        '&ctz=America/Chicago' +
        '&mode=WEEK' +
        '&showTitle=0' +
        '&showNav=1' +
        '&showDate=1' +
        '&showPrint=0' +
        '&showTabs=1' +
        '&showCalendars=0' +
        '&showTz=1' +
        '&height=600' +
        '&wkst=1';
      
      return NextResponse.json({ 
        embedUrl,
        message: 'Successfully generated embed URL'
      });
    } catch (verifyError) {
      console.error('Error verifying token:', verifyError);
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid token' },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error('Error in embed-url route:', error);
    return NextResponse.json(
      { error: 'Failed to generate embed URL', details: error.message },
      { status: 500 }
    );
  }
} 