// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');

// Format the private key if needed
const formatPrivateKey = (key) => {
  if (!key) return '';
  if (key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('-----END PRIVATE KEY-----')) {
    return key;
  }
  return key.replace(/\\n/g, '\n');
};

// Log environment variables (without showing the full private key)
console.log('Environment Variables:');
console.log('FIREBASE_ADMIN_PROJECT_ID:', process.env.FIREBASE_ADMIN_PROJECT_ID);
console.log('FIREBASE_ADMIN_CLIENT_EMAIL:', process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
console.log('FIREBASE_ADMIN_PRIVATE_KEY length:', process.env.FIREBASE_ADMIN_PRIVATE_KEY ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.length : 0);
console.log('FIREBASE_ADMIN_PRIVATE_KEY starts with:', process.env.FIREBASE_ADMIN_PRIVATE_KEY ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.substring(0, 30) + '...' : 'N/A');

// Create service account object
const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
};

console.log('Service Account:');
console.log('projectId:', serviceAccount.projectId);
console.log('clientEmail:', serviceAccount.clientEmail);
console.log('privateKey length:', serviceAccount.privateKey ? serviceAccount.privateKey.length : 0);
console.log('privateKey starts with:', serviceAccount.privateKey ? serviceAccount.privateKey.substring(0, 30) + '...' : 'N/A');

try {
  // Initialize Firebase Admin SDK
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase Admin SDK initialized successfully');
  
  // Test auth functionality
  const auth = admin.auth(app);
  console.log('Firebase Admin Auth initialized successfully');
  
  // Test listing users (limited to 1)
  auth.listUsers(1)
    .then((listUsersResult) => {
      console.log('Successfully listed users:');
      listUsersResult.users.forEach((userRecord) => {
        console.log('User:', userRecord.toJSON());
      });
    })
    .catch((error) => {
      console.error('Error listing users:', error);
    });
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
} 