import { getFirebaseAdminDb } from './firebase-admin';

/**
 * Records a processing history entry in Firestore
 */
export async function recordProcessingHistory(data: {
  userId: string;
  fileName: string;
  fileType: string;
  eventCount: number;
  status: 'success' | 'partial' | 'failed';
}) {
  try {
    const db = getFirebaseAdminDb();
    
    // Ensure the collection exists by attempting to write to it
    await db.collection('processingHistory').add({
      userId: data.userId,
      fileName: data.fileName,
      fileType: data.fileType,
      eventCount: data.eventCount,
      status: data.status,
      processedAt: new Date().toISOString(),
    });
    
    console.log(`Recorded processing history for ${data.fileName}`);
    return true;
  } catch (error) {
    console.error('Error recording processing history:', error);
    // Don't throw the error - we don't want to break the main process if history recording fails
    return false;
  }
} 