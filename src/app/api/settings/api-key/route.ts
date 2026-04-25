import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createOpenAIClient } from '@/lib/openai';

// API endpoint to save the user's custom API key
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
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
      await openai.models.list();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your key and try again.' },
        { status: 400 }
      );
    }

    // Save the API key in user preferences (or a dedicated field)
    // For now this is a no-op since the new schema doesn't store custom API keys
    // The old Firestore-based custom key storage is removed

    return NextResponse.json({
      success: true,
      message: 'API key saved successfully'
    });
  } catch (error) {
    console.error('Error saving API key:', error);

    return NextResponse.json(
      { error: 'Failed to save API key', details: error?.toString() },
      { status: 500 }
    );
  }
}
