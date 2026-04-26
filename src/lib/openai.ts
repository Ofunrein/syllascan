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

Extract ALL calendar events, deadlines, class sessions, assignments, exams, quizzes, sprints, and scheduled items.

For each event return JSON with:
- title (required)
- description
- date: YYYY-MM-DD. Default year is ${currentYear} unless stated otherwise.
- startTime: HH:MM 24h
- endTime: HH:MM 24h
- location
- type: "exam" | "assignment" | "discussion" | "reading" | "class" | "meeting" | "personal" | "other"
- isRecurring: bool
- recurrencePattern
- confidence: 0.0-1.0

Rules:
- Every row in a schedule table = one class event
- "exam/midterm/final/quiz" → type "exam"
- "due/submit/assignment/project/paper" → type "assignment"
- "class/lecture/lab/week" → type "class"
- "sprint/standup/demo" → type "meeting"

Return ONLY: {"events": [...]}`;
}

function extractJsonFromText(text: string): any {
  try { return JSON.parse(text); } catch {}
  const objMatch = text.match(/\{[\s\S]*"events"[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return { events: JSON.parse(arrMatch[0]) }; } catch {} }
  return null;
}

export async function extractEventsFromText(text: string): Promise<ExtractedEvent[]> {
  const prompt = buildExtractionPrompt();
  const response = await openai.chat.completions.create({
    model: 'gpt-5.4-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `Extract all calendar events:\n\n${text}` },
    ],
    max_completion_tokens: 4096,
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

  // Use Responses API for vision (required for gpt-5.4-mini per OpenAI docs)
  const imageInputs = images.map((img) => ({
    type: 'input_image' as const,
    image_url: `data:${img.mimeType};base64,${img.base64}`,
    detail: 'high' as const,
  }));

  // @ts-ignore — Responses API types may not be in older SDK versions
  const response = await (openai as any).responses.create({
    model: 'gpt-5.4-mini',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `${prompt}\n\nExtract ALL calendar events from these document pages. Return JSON with key "events".`,
          },
          ...imageInputs,
        ],
      },
    ],
  });

  const content: string = response.output_text ?? '';
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
