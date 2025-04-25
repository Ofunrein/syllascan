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

// Load service account from JSON file if environment variables are not set
let serviceAccount: any;

try {
  // Try to use environment variables first
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && 
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL && 
      process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    serviceAccount = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
    };
    console.log('Using Firebase Admin SDK credentials from environment variables');
  } else {
    // Fallback to JSON file if environment variables are not set
    const jsonPath = path.resolve(process.cwd(), 'gcalocr2-firebase-adminsdk-fbsvc-abe7cba762.json');
    const serviceAccountRaw = fs.readFileSync(jsonPath, 'utf8');
    const serviceAccountJson = JSON.parse(serviceAccountRaw);
    
    serviceAccount = {
      projectId: serviceAccountJson.project_id,
      clientEmail: serviceAccountJson.client_email,
      privateKey: serviceAccountJson.private_key
    };
    console.log('Using Firebase Admin SDK credentials from service account JSON file');
  }
} catch (error) {
  console.error('Error loading Firebase Admin SDK credentials:', error);
  // Set default values for initialization to still work
  serviceAccount = {
    projectId: 'gcalocr2',
    clientEmail: 'firebase-adminsdk-fbsvc@gcalocr2.iam.gserviceaccount.com',
    privateKey: ''
  };
}

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
      console.log('Initializing Firebase Admin with project:', serviceAccount.projectId);
      
      // Check if required service account properties are available
      if (!serviceAccount.projectId) {
        throw new Error('Missing projectId in Firebase Admin service account');
      }
      
      if (!serviceAccount.clientEmail) {
        throw new Error('Missing clientEmail in Firebase Admin service account');
      }
      
      if (!serviceAccount.privateKey) {
        throw new Error('Missing privateKey in Firebase Admin service account');
      }
      
      // Check if the private key is properly formatted
      if (!serviceAccount.privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('Firebase Admin privateKey is not properly formatted');
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

/**
 * Initialize Firebase Admin SDK
 */
export function initAdmin() {
  return getFirebaseAdminApp();
} 