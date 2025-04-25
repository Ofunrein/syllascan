import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { saveCustomApiKey } from '@/lib/apiKeyManager';
import { createOpenAIClient } from '@/lib/openai';

// API endpoint to save the user's custom API key
export async function POST(request: NextRequest) {
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
    
    // Parse request body
    const body = await request.json();
    const { apiKey } = body;
    
    // Validate API key
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-')) {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 400 }
      );
    }
    
    // Verify API key works with OpenAI
    try {
      const openai = createOpenAIClient(apiKey);
      // Try a simple call to check if the API key is valid
      await openai.models.list();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your key and try again.' },
        { status: 400 }
      );
    }
    
    // Save the API key
    const success = await saveCustomApiKey(session, apiKey);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to save API key' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'API key saved successfully'
    });
  } catch (error) {
    console.error('Error saving API key:', error);
    
    return NextResponse.json(
      { error: 'Failed to save API key', details: error.toString() },
      { status: 500 }
    );
  }
} 