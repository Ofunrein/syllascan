import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    const decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get the user's processing history from Firestore
    const db = getFirebaseAdminDb();
    
    try {
      const historySnapshot = await db
        .collection('processingHistory')
        .where('userId', '==', uid)
        .orderBy('processedAt', 'desc')
        .limit(20)
        .get();

      const records = historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return NextResponse.json({ records });
    } catch (dbError: any) {
      // Handle NOT_FOUND error (code 5) which occurs when collection doesn't exist yet
      if (dbError.code === 5 || dbError.message?.includes('NOT_FOUND')) {
        console.log('Processing history collection not found, returning empty array');
        return NextResponse.json({ records: [] });
      }
      // Re-throw other errors
      throw dbError;
    }
  } catch (error) {
    console.error('Error getting processing history:', error);
    return NextResponse.json(
      { error: 'Failed to get processing history' },
      { status: 500 }
    );
  }
} 