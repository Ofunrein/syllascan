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

function buildExtractionPrompt(): string {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.toLocaleString('en-US', { month: 'long' });

  return `You are an expert academic calendar assistant. Today is ${currentMonth} ${today.getDate()}, ${currentYear}.

Analyze the provided content and extract ALL calendar events, deadlines, important dates, and scheduled items — including class sessions, lectures, assignments, exams, quizzes, project milestones, office hours, and sprints.

For each event found, return a JSON object with these fields:
- title (required): Clear, concise event name
- description: Brief details about the event
- date: Date in YYYY-MM-DD format. Use ${currentYear} as the default year unless another year is clearly indicated. If only month/day is given (e.g., "Jan 20"), assume year ${currentYear}.
- startTime: Start time in HH:MM 24-hour format (e.g., "14:00")
- endTime: End time in HH:MM 24-hour format
- location: Room number, building, or online link
- type: One of "exam", "assignment", "discussion", "reading", "class", "meeting", "personal", "other"
- isRecurring: true if this event repeats
- recurrencePattern: e.g., "weekly on Monday", "every Tuesday and Thursday"
- confidence: 0.0-1.0

Classification guidance:
- "exam", "midterm", "final", "test", "quiz" → type "exam"
- "due", "submit", "assignment", "homework", "project", "paper" → type "assignment"
- "class", "lecture", "lab", "section", "week", schedule rows → type "class"
- "sprint", "standup", "planning", "demo", "retrospective" → type "meeting"
- "discussion", "forum", "post" → type "discussion"
- "office hours", "appointment" → type "meeting"

IMPORTANT: Extract every row from schedule tables, even if they only list topics. Each date in a schedule table is a class session that should be extracted.

Return ONLY a JSON object with key "events" containing an array of event objects. Example:
{"events": [{"title": "CS 3398 Class - Agile Concepts", "date": "${currentYear}-01-20", "type": "class", "confidence": 0.9}]}

Return {"events": []} if truly no events exist.`;
}

function extractJsonFromText(text: string): any {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {}

  // Try to find JSON object in the text
  const jsonMatch = text.match(/\{[\s\S]*"events"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  // Try to find array directly
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return { events: JSON.parse(arrayMatch[0]) };
    } catch {}
  }

  return null;
}

export async function extractEventsFromText(text: string): Promise<ExtractedEvent[]> {
  const prompt = buildExtractionPrompt();
  const response = await openai.chat.completions.create({
    model: 'gpt-5.4-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `Extract all calendar events from this document:\n\n${text}` },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  const parsed = extractJsonFromText(content);
  return parsed?.events || [];
}

export async function extractEventsFromImages(
  images: { base64: string; mimeType: string }[]
): Promise<ExtractedEvent[]> {
  const prompt = buildExtractionPrompt();

  const imageContent: OpenAI.ChatCompletionContentPart[] = images.map((img) => ({
    type: 'image_url' as const,
    image_url: {
      url: `data:${img.mimeType};base64,${img.base64}`,
      detail: 'high' as const,
    },
  }));

  // Vision requests must NOT use response_format — parse JSON from content instead
  const response = await openai.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract ALL calendar events, class sessions, deadlines, and scheduled dates from these document pages. Return JSON with key "events".',
          },
          ...imageContent,
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  const parsed = extractJsonFromText(content);
  return parsed?.events || [];
}

export async function extractEventsFromImage(base64Image: string): Promise<ExtractedEvent[]> {
  return extractEventsFromImages([{ base64: base64Image, mimeType: 'image/jpeg' }]);
}

export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

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
