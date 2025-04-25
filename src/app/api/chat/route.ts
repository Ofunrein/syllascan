import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Event } from '@/lib/openai';

// Only create OpenAI client if API key is available
// This prevents build errors when the key is not set
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI client is initialized
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }
    
    const { message, event } = await request.json();
    
    if (!message || !event) {
      return NextResponse.json(
        { error: 'Missing message or event data' },
        { status: 400 }
      );
    }
    
    console.log('Processing chat message:', message);
    console.log('Current event:', event);
    
    // Create a system prompt that explains the task and includes the word 'json'
    const systemPrompt = `
      You are an AI assistant helping a user modify calendar event details.
      The user will provide instructions on how they want to modify an event.
      You should interpret their instructions and update the event details accordingly.
      
      Current event details:
      - Title: ${event.title}
      - Description: ${event.description || 'None'}
      - Start Date: ${event.startDate}
      - End Date: ${event.endDate || 'Same as start date'}
      - Location: ${event.location || 'None'}
      - All Day Event: ${event.isAllDay ? 'Yes' : 'No'}
      
      Respond in a helpful, conversational way and explain what changes you've made.
      Return the updated event details in a structured JSON format that can be parsed by the application.
      
      Your response MUST be valid JSON with the following structure:
      {
        "message": "Your helpful response to the user",
        "event": {
          "title": "Updated title if changed",
          "description": "Updated description if changed",
          "startDate": "Updated start date if changed (ISO format)",
          "endDate": "Updated end date if changed (ISO format)",
          "location": "Updated location if changed",
          "isAllDay": true/false (if changed)
        }
      }
      
      Only include fields in the "event" object that have been changed based on the user's request.
    `;
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in response");
    }
    
    console.log('OpenAI response:', content);
    
    // Parse the response
    const parsedResponse = JSON.parse(content);
    
    // Extract the message and updated event
    const aiMessage = parsedResponse.message || "I've updated the event based on your request.";
    const updatedEvent = parsedResponse.event || {};
    
    return NextResponse.json({
      message: aiMessage,
      updatedEvent
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', details: error.toString() },
      { status: 500 }
    );
  }
} 