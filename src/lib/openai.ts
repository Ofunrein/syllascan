import OpenAI from 'openai';

// Define event type
export interface Event {
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  type?: string;
}

// Get API key with fallback for development
const getApiKey = () => {
  // Use environment variable in production, or the hardcoded key for development
  const apiKey = process.env.OPENAI_API_KEY;
  
  // If no API key is found, log a warning and use a placeholder
  if (!apiKey) {
    console.warn('No OpenAI API key found in environment variables');
    // Add a placeholder instead of the actual key 
    return "sk-placeholder-key-for-development";
  }
  
  return apiKey;
};

// Create OpenAI client
const createClient = () => {
  return new OpenAI({ apiKey: getApiKey() });
};

/**
 * Extract events from an image using OpenAI's Vision model
 */
export async function extractEventsFromImage(
  base64Image: string,
  apiKey: string = getApiKey()
): Promise<Event[]> {
  // Validate inputs
  if (!base64Image) {
    console.error('No image data provided');
    throw new Error('Image data is required');
  }
  
  const openai = createClient();
  
  const prompt = `
    Extract all calendar events from this document image. 
    Look for dates, times, deadlines, assignments, exams, holidays, and any other scheduled events.
    
    For each event, provide the following information in a structured format:
    - title: The name or title of the event (required)
    - description: A brief description of the event, if available (optional)
    - date: The date of the event in YYYY-MM-DD format (required)
    - startTime: Start time in 24-hour format HH:MM, if available (optional)
    - endTime: End time in 24-hour format HH:MM, if available (optional)
    - location: The location of the event, if available (optional)
    - type: The type of event (e.g., assignment, exam, holiday, lecture, etc.), if discernible (optional)
    
    Format your response as a valid JSON array containing event objects. Infer/derive dates from context if not explicitly stated (e.g., "next Monday" should be converted to an actual date).
    If you see relative dates like "Week 1" or "Day 3", use the context of the document to determine the actual date.
    
    Be thorough and extract ALL events mentioned in the document, even if some information is missing.
    
    If the image does not contain any events, return an empty array.
  `;
  
  try {
    console.log('Calling OpenAI API with image...');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });
    
    console.log('OpenAI API response received');
    
    const content = response.choices[0].message.content;
    
    if (!content) {
      console.log('No content in OpenAI response');
      return [];
    }
    
    try {
      console.log('Parsing response content...');
      // Try direct JSON parsing first
      const events = JSON.parse(content) as Event[];
      return events;
    } catch (firstError) {
      console.log('Direct JSON parsing failed, trying to extract JSON from response');
      
      try {
        // Extract the JSON part from the content
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (jsonMatch) {
          const events = JSON.parse(jsonMatch[0]) as Event[];
          return events;
        }
        
        // One more fallback: try removing markdown code blocks
        const cleanedContent = content.replace(/```(?:json)?\n?([\s\S]*?)\n?```/g, '$1').trim();
        const events = JSON.parse(cleanedContent) as Event[];
        return events;
      } catch (parseError) {
        console.error('Failed to parse OpenAI response as JSON');
        console.log('Raw response:', content);
        return [];
      }
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

// Function to create an OpenAI client with a specific API key
export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey,
  });
} 