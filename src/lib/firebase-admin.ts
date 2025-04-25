import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Check if the private key is properly formatted
const formatPrivateKey = (key: string | undefined) => {
  if (!key) return '';
  
  // If the key is already properly formatted, return it as is
  if (key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('-----END PRIVATE KEY-----')) {
    return key;
  }
  
  // Replace escaped newlines with actual newlines
  return key.replace(/\\n/g, '\n');
};

// Initialize Firebase Admin SDK (server-side)
export function getFirebaseAdminApp() {
  if (admin.apps.length > 0) {
    console.log('Using existing Firebase Admin SDK app');
    return admin.apps[0];
  }

  try {
    // Try to use environment variables first
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && 
        process.env.FIREBASE_ADMIN_CLIENT_EMAIL && 
        process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const privateKey = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
      
      console.log('Using Firebase Admin SDK credentials from environment variables');
      console.log('Firebase Admin SDK Service Account:', {
        projectId,
        clientEmail,
        privateKeyProvided: !!privateKey,
        privateKeyLength: privateKey.length,
        privateKeyStart: privateKey.substring(0, 25) + '...'
      });

      console.log('Initializing Firebase Admin with project:', projectId);
      
      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      // Fallback to JSON file if environment variables are not set
      try {
        const jsonPath = path.resolve(process.cwd(), 'gcalocr2-firebase-adminsdk-fbsvc-abe7cba762.json');
        const serviceAccountRaw = fs.readFileSync(jsonPath, 'utf8');
        const serviceAccountJson = JSON.parse(serviceAccountRaw);
        
        const serviceAccount = {
          projectId: serviceAccountJson.project_id,
          clientEmail: serviceAccountJson.client_email,
          privateKey: serviceAccountJson.private_key
        };
        
        console.log('Using Firebase Admin SDK credentials from service account JSON file');
        console.log('Firebase Admin SDK Service Account:', {
          projectId: serviceAccount.projectId,
          clientEmail: serviceAccount.clientEmail,
          privateKeyProvided: !!serviceAccount.privateKey,
          privateKeyLength: serviceAccount.privateKey.length,
          privateKeyStart: serviceAccount.privateKey.substring(0, 25) + '...'
        });
        
        console.log('Initializing Firebase Admin with project:', serviceAccount.projectId);
        
        return admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        });
      } catch (fileError) {
        console.error('Error loading Firebase Admin SDK credentials from file:', fileError);
        throw new Error('Failed to initialize Firebase Admin: No credentials available');
      }
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

export const getFirebaseAdminAuth = () => {
  try {
    const app = getFirebaseAdminApp();
    return admin.auth(app);
  } catch (error) {
    console.error('Error getting Firebase Admin Auth:', error);
    throw error;
  }
};

export const getFirebaseAdminDb = () => {
  try {
    const app = getFirebaseAdminApp();
    return admin.firestore(app);
  } catch (error) {
    console.error('Error getting Firebase Admin Firestore:', error);
    throw error;
  }
}; 

/**
 * Initialize Firebase Admin SDK
 */
export function initAdmin() {
  return getFirebaseAdminApp();
} 