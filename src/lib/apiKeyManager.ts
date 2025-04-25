import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from './firebase-admin';
import { Session } from 'next-auth';

// Initialize Firebase Admin if not already done
const app = getFirebaseAdminApp();
const db = getFirestore(app);

interface ApiUsageRecord {
  userId: string;
  email: string;
  usageCount: number;
  customApiKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Check if a user can use the default API key or needs to provide their own
 */
export async function canUseDefaultApiKey(session: Session | null): Promise<boolean> {
  if (!session?.user?.email) {
    return false; // No session, can't use default key
  }

  const userId = session.user.id || session.user.email;
  
  try {
    const usageRef = db.collection('apiUsage').doc(userId);
    const usageDoc = await usageRef.get();
    
    if (!usageDoc.exists) {
      // First-time user, create usage record
      await usageRef.set({
        userId,
        email: session.user.email,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return true;
    }
    
    const usage = usageDoc.data() as ApiUsageRecord;
    
    // If user has a custom API key, they should use that
    if (usage.customApiKey) {
      return false;
    }
    
    // Check if under the free usage limit
    return usage.usageCount < 5;
  } catch (error) {
    console.error('Error checking API key usage:', error);
    return false; // Default to requiring own key on error
  }
}

/**
 * Increment the API usage count for a user
 */
export async function incrementApiUsage(session: Session | null): Promise<void> {
  if (!session?.user?.email) return;
  
  const userId = session.user.id || session.user.email;
  
  try {
    const usageRef = db.collection('apiUsage').doc(userId);
    
    // Use transaction to safely increment
    await db.runTransaction(async (transaction) => {
      const usageDoc = await transaction.get(usageRef);
      
      if (!usageDoc.exists) {
        transaction.set(usageRef, {
          userId,
          email: session.user.email,
          usageCount: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        const usage = usageDoc.data() as ApiUsageRecord;
        transaction.update(usageRef, { 
          usageCount: usage.usageCount + 1,
          updatedAt: new Date()
        });
      }
    });
  } catch (error) {
    console.error('Error incrementing API usage:', error);
  }
}

/**
 * Save a custom API key for a user
 */
export async function saveCustomApiKey(session: Session | null, apiKey: string): Promise<boolean> {
  if (!session?.user?.email) return false;
  
  const userId = session.user.id || session.user.email;
  
  try {
    const usageRef = db.collection('apiUsage').doc(userId);
    
    await usageRef.set({
      userId,
      email: session.user.email,
      customApiKey: apiKey,
      updatedAt: new Date()
    }, { merge: true });
    
    return true;
  } catch (error) {
    console.error('Error saving custom API key:', error);
    return false;
  }
}

/**
 * Get the API key to use for a request
 */
export async function getApiKey(session: Session | null): Promise<string | null> {
  if (!session?.user?.email) return null;
  
  const userId = session.user.id || session.user.email;
  
  try {
    const usageRef = db.collection('apiUsage').doc(userId);
    const usageDoc = await usageRef.get();
    
    if (!usageDoc.exists) {
      return process.env.OPENAI_API_KEY || null;
    }
    
    const usage = usageDoc.data() as ApiUsageRecord;
    
    // Return custom key if available, otherwise default
    return usage.customApiKey || process.env.OPENAI_API_KEY || null;
  } catch (error) {
    console.error('Error getting API key:', error);
    return null;
  }
} 