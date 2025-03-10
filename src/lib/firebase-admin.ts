import * as admin from 'firebase-admin';

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

// Server-side Firebase config
const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
};

// Log the service account details (without the full private key for security)
console.log('Firebase Admin SDK Service Account:', {
  projectId: serviceAccount.projectId,
  clientEmail: serviceAccount.clientEmail,
  privateKeyProvided: !!serviceAccount.privateKey,
  privateKeyLength: serviceAccount.privateKey ? serviceAccount.privateKey.length : 0,
  privateKeyStart: serviceAccount.privateKey ? serviceAccount.privateKey.substring(0, 30) + '...' : 'N/A',
});

// Initialize Firebase Admin SDK (server-side)
let adminApp: admin.app.App | undefined;

export const getFirebaseAdminApp = () => {
  if (!adminApp) {
    try {
      console.log('Initializing Firebase Admin with project:', process.env.FIREBASE_ADMIN_PROJECT_ID);
      
      // Check if required environment variables are set
      if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
        throw new Error('Missing FIREBASE_ADMIN_PROJECT_ID in environment variables');
      }
      
      if (!process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
        throw new Error('Missing FIREBASE_ADMIN_CLIENT_EMAIL in environment variables');
      }
      
      if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
        throw new Error('Missing FIREBASE_ADMIN_PRIVATE_KEY in environment variables');
      }
      
      // Check if the private key is properly formatted
      if (!serviceAccount.privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not properly formatted');
      }
      
      if (admin.apps.length === 0) {
        // Initialize with credential only first
        adminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
        });
        
        console.log('Firebase Admin SDK initialized successfully');
      } else {
        adminApp = admin.app();
        console.log('Using existing Firebase Admin SDK app');
      }
      
      return adminApp;
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
      throw error;
    }
  }
  return adminApp;
};

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