import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase';

// Initialize Firebase Admin
initAdmin();
const db = getFirestore();

// API endpoint to get the user's API usage data
export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    // Check if user is logged in
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id || session.user.email;
    
    // Get the user's API usage data from Firestore
    const usageRef = db.collection('apiUsage').doc(userId);
    const usageDoc = await usageRef.get();
    
    if (!usageDoc.exists) {
      // No usage data yet, return default values
      return NextResponse.json({
        usageCount: 0,
        hasCustomKey: false
      });
    }
    
    const usageData = usageDoc.data();
    
    return NextResponse.json({
      usageCount: usageData.usageCount || 0,
      hasCustomKey: !!usageData.customApiKey
    });
  } catch (error) {
    console.error('Error fetching API usage data:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch API usage data', details: error.toString() },
      { status: 500 }
    );
  }
} 