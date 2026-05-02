import { NextRequest, NextResponse } from 'next/server';
import { extractEventsFromText, extractEventsFromImages } from '@/lib/openai';
import { convertDocument } from '@/lib/documentConverter';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

// Extend Vercel function timeout to 60s (default 10s is too short for LLM calls)
export const maxDuration = 60;

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'text/rtf',
  'text/html',
  'text/calendar',
  'application/rtf',
]);

function isAcceptedType(mimeType: string): boolean {
  if (mimeType.startsWith('image/')) return true;
  return ACCEPTED_MIME_TYPES.has(mimeType);
}

function classifyCategory(eventType: string): string {
  switch (eventType) {
    case 'exam':
    case 'assignment':
    case 'discussion':
    case 'reading':
    case 'class':
      return 'academic';
    case 'meeting':
      return 'work';
    case 'personal':
      return 'personal';
    default:
      return 'other';
  }
}

function processEvent(event: any): any {
  const id = uuidv4();
  const title = event.title?.trim() || 'Unnamed Event';

  // Handle date fields — use string parsing to avoid UTC shifting
  let eventDate = event.date || event.startDate || '';
  let startTime = event.startTime || '';
  let endTime = event.endTime || '';
  const isAllDay = event.isAllDay || (!startTime && !endTime);

  // Standardize date format if a date is provided
  if (eventDate) {
    // If already YYYY-MM-DD, keep as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      // Already correct format
    } else {
      try {
        // Parse and extract date parts without UTC conversion
        const dateObj = new Date(eventDate);
        if (!isNaN(dateObj.getTime())) {
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          eventDate = `${year}-${month}-${day}`;
        }
      } catch (error) {
        console.warn(`Failed to parse date for event "${title}":`, error);
      }
    }
  }

  // Validate and format times
  if (startTime && !startTime.match(/^\d{1,2}:\d{2}$/)) {
    startTime = '';
  }
  if (endTime && !endTime.match(/^\d{1,2}:\d{2}$/)) {
    endTime = '';
  }

  // Create proper startDate and endDate strings for Google Calendar
  let startDate = '';
  let endDate = '';

  if (eventDate) {
    if (startTime) {
      startDate = `${eventDate}T${startTime.padStart(5, '0')}:00`;
    } else {
      startDate = eventDate;
    }

    if (endTime) {
      endDate = `${eventDate}T${endTime.padStart(5, '0')}:00`;
    } else {
      endDate = startDate;
    }
  }

  // Smart type detection
  let eventType = event.type || '';
  if (!eventType) {
    const titleLower = title.toLowerCase();
    const descLower = (event.description || '').toLowerCase();

    if (titleLower.includes('exam') || titleLower.includes('test') ||
        titleLower.includes('quiz') || titleLower.includes('final') ||
        titleLower.includes('midterm')) {
      eventType = 'exam';
    } else if (titleLower.includes('assignment') || titleLower.includes('due') ||
              titleLower.includes('submit') || titleLower.includes('paper') ||
              titleLower.includes('essay') || titleLower.includes('homework') ||
              titleLower.includes('project') || descLower.includes('due')) {
      eventType = 'assignment';
    } else if (titleLower.includes('discuss') ||
              descLower.includes('discuss') || descLower.includes('forum')) {
      eventType = 'discussion';
    } else if (descLower.includes('p.') || descLower.match(/pp\.\s*\d+/) ||
               descLower.includes('chapter') || descLower.includes('page') ||
               titleLower.includes('read')) {
      eventType = 'reading';
    } else if (titleLower.includes('meeting') || titleLower.includes('office hours') ||
               titleLower.includes('appointment')) {
      eventType = 'meeting';
    } else {
      eventType = 'class';
    }
  }

  return {
    id,
    title,
    description: event.description || '',
    date: eventDate,
    startDate,
    endDate,
    startTime,
    endTime,
    isAllDay,
    location: event.location || '',
    type: eventType,
    category: classifyCategory(eventType),
    confidence: event.confidence ?? null,
    isRecurring: event.isRecurring || false,
    recurrencePattern: event.recurrencePattern || '',
  };
}

export async function POST(request: NextRequest) {
  console.log('Extract events API route called');

  try {
    // Auth via Supabase
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const formData = await request.formData();
    const fileEntries = Array.from(formData.entries()).filter(([key]) => key.startsWith('file'));

    console.log(`Received ${fileEntries.length} files for processing`);

    if (fileEntries.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const allEvents: any[] = [];
    const errors: { file: string; error: string }[] = [];

    for (const [, file] of fileEntries) {
      if (!(file instanceof File)) {
        continue;
      }

      const fileName = file.name;
      const fileType = file.type || 'application/octet-stream';

      console.log('Processing file:', fileName, 'type:', fileType);

      if (!isAcceptedType(fileType)) {
        errors.push({ file: fileName, error: `Unsupported file type: ${fileType}` });
        continue;
      }

      let converted;
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        converted = await convertDocument(buffer, fileName, fileType);
        console.log(`Converted ${fileName}: type=${converted.type}, pages=${converted.pageCount}`);
      } catch (convError: any) {
        console.error(`Error converting ${fileName}:`, convError);
        errors.push({ file: fileName, error: convError.message || 'Failed to convert file' });
        continue;
      }

      let extractedEvents: any[] = [];
      try {
        if (converted.type === 'text' && converted.text) {
          extractedEvents = await extractEventsFromText(converted.text);
        } else if (converted.type === 'images' && converted.images) {
          // Batch images in groups of 5
          const images = converted.images;
          for (let i = 0; i < images.length; i += 5) {
            const batch = images.slice(i, i + 5);
            const batchEvents = await extractEventsFromImages(batch);
            extractedEvents.push(...batchEvents);
          }
        }
      } catch (extractError: any) {
        console.error(`Error extracting events from ${fileName}:`, extractError);
        errors.push({ file: fileName, error: 'Failed to extract events: ' + (extractError.message || 'Unknown error') });
        continue;
      }

      if (!extractedEvents || !Array.isArray(extractedEvents) || extractedEvents.length === 0) {
        console.log(`No events extracted from ${fileName}`);
        continue;
      }

      console.log(`Extracted ${extractedEvents.length} events from ${fileName}`);

      const processedEvents = extractedEvents
        .filter(event => event && typeof event === 'object' && event.title)
        .map(event => ({
          ...processEvent(event),
          sourceFile: fileName,
          sourceFileType: fileType,
        }));

      allEvents.push(...processedEvents);
    }

    // Deduplicate across all files
    const uniqueEvents = Array.from(
      new Map(allEvents.map(event =>
        [`${event.title.toLowerCase()}_${event.date || ''}_${event.startTime || ''}`, event]
      )).values()
    );

    console.log(`Total: ${allEvents.length}, after dedup: ${uniqueEvents.length}`);

    // Record processing history to Supabase if user is authenticated
    if (user) {
      try {
        await supabase.from('processing_history').insert({
          user_id: user.id,
          file_count: fileEntries.filter(([, f]) => f instanceof File).length,
          event_count: uniqueEvents.length,
          processed_at: new Date().toISOString(),
        });
      } catch (historyError) {
        console.warn('Failed to record processing history:', historyError);
      }
    }

    if (uniqueEvents.length === 0) {
      return NextResponse.json({
        message: errors.length > 0
          ? 'No events could be extracted from the provided files'
          : 'No events found in the provided files',
        events: [],
        count: 0,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return NextResponse.json({
      events: uniqueEvents,
      count: uniqueEvents.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error processing files:', error);
    return NextResponse.json(
      {
        error: 'Failed to process files',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
