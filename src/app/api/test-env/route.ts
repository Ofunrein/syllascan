import { NextResponse } from 'next/server';

export async function GET() {
  // Check environment variables
  const envVars = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKeyLength: process.env.FIREBASE_ADMIN_PRIVATE_KEY ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.length : 0,
    privateKeyStart: process.env.FIREBASE_ADMIN_PRIVATE_KEY ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.substring(0, 30) + '...' : 'N/A',
    nextPublicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };

  console.log('Environment variables in API route:', envVars);

  return NextResponse.json({ 
    message: 'Environment variables check', 
    envVars: {
      ...envVars,
      // Don't return the actual private key start in the response
      privateKeyStart: envVars.privateKeyLength > 0 ? 'Available (not shown)' : 'Not available'
    }
  });
} 