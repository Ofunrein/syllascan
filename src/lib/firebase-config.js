// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB735MUXM6G6HXao6-4SpMnmWOCX-XK9Ig",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "gcalocr2.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gcalocr2",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "gcalocr2.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "61015307582",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:61015307582:web:3939193205e726d522e86f",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-9EH3MQMKMK"
};

console.log("Firebase config loaded:", { 
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
});

export default firebaseConfig; 