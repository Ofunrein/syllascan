import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedEvent {
  title: string;
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  type?: string;
  isRecurring?: boolean;
  recurrencePattern?: string;
  confidence?: number;
}

const EXTRACTION_PROMPT = `You are an expert academic calendar assistant. Analyze the provided document content and extract ALL calendar events, deadlines, and important dates.

For each event found, return a JSON object with these fields:
- title (required): Clear, concise event name
- description: Brief details about the event
- date: Date in YYYY-MM-DD format. If only a day of week is given (e.g., "every Tuesday"), note this in recurrencePattern instead.
- startTime: Start time in HH:MM 24-hour format (e.g., "14:00")
- endTime: End time in HH:MM 24-hour format
- location: Room number, building, or online link
- type: One of "exam", "assignment", "discussion", "reading", "class", "meeting", "personal", "other"
- isRecurring: true if this event repeats (e.g., "every Monday", "weekly")
- recurrencePattern: e.g., "weekly on Monday", "every Tuesday and Thursday"
- confidence: 0.0-1.0 indicating how confident you are this is a real event with correct details

Classification guidance:
- "exam", "midterm", "final", "test", "quiz" → type "exam"
- "due", "submit", "assignment", "homework", "project", "paper" → type "assignment"
- "discussion", "forum", "post", "reply" → type "discussion"
- "read", "chapter", "pages" → type "reading"
- "class", "lecture", "lab", "section" → type "class"
- "meeting", "office hours", "appointment" → type "meeting"

Context clues:
- Infer the semester/year from document context if possible
- If dates reference "Week 1", "Week 2", etc., try to resolve to actual dates based on any semester start date mentioned
- For relative dates like "next Friday", flag them with lower confidence

Return a JSON object with key "events" containing an array of event objects. Return {"events": []} if no events found.`;

export async function extractEventsFromText(text: string): Promise<ExtractedEvent[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: `Extract all calendar events from this document:\n\n${text}` },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.events || [];
  } catch (error) {
    console.error('Error extracting events from text:', error);
    return [];
  }
}

export async function extractEventsFromImages(
  images: { base64: string; mimeType: string }[]
): Promise<ExtractedEvent[]> {
  try {
    const imageContent: OpenAI.ChatCompletionContentPart[] = images.map((img) => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
        detail: 'high' as const,
      },
    }));

    const response = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all calendar events from these document pages:' },
            ...imageContent,
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.events || [];
  } catch (error) {
    console.error('Error extracting events from images:', error);
    return [];
  }
}

// Keep backward compatibility
export async function extractEventsFromImage(base64Image: string): Promise<ExtractedEvent[]> {
  return extractEventsFromImages([{ base64: base64Image, mimeType: 'image/jpeg' }]);
}

// Create an OpenAI client with a specific API key
export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

// Backward-compatible Event type used by components
// Maps to the shape components expect (camelCase, ISO date strings)
export interface Event {
  id: string;
  title: string;
  description?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  type?: string;
  category?: string;
  source?: string;
  isAllDay?: boolean;
  isRecurring?: boolean;
  recurrencePattern?: string;
  confidence?: number;
  google_event_id?: string;
}
