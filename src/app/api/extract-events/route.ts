import { NextRequest, NextResponse } from 'next/server';
import { extractEventsFromImage } from '@/lib/openai';
import * as pdfjs from 'pdfjs-dist';
import { v4 as uuidv4 } from 'uuid';

// Initialize PDF.js worker
if (typeof window === 'undefined') {
  // Server-side only
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

// Robust event processing function
function processEvent(event: any): any {
  // Generate an ID for every event
  const id = uuidv4();
  
  // Basic validation - title is required
  const title = event.title?.trim() || 'Unnamed Event';
  
  // Handle date fields
  let eventDate = event.date || event.startDate || '';
  let startTime = event.startTime || '';
  let endTime = event.endTime || '';
  let isAllDay = event.isAllDay || (!startTime && !endTime);
  
  // Standardize date format if a date is provided
  if (eventDate) {
    try {
      // Parse and format the date
      const dateObj = new Date(eventDate);
      if (!isNaN(dateObj.getTime())) {
        eventDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
      }
    } catch (error) {
      console.warn(`Failed to parse date for event "${title}":`, error);
    }
  }
  
  // Validate and format times
  if (startTime) {
    // Simple validation: ensure HH:MM format
    if (!startTime.match(/^\d{1,2}:\d{2}$/)) {
      startTime = '';
    }
  }
  
  if (endTime) {
    // Simple validation: ensure HH:MM format
    if (!endTime.match(/^\d{1,2}:\d{2}$/)) {
      endTime = '';
    }
  }
  
  // Create proper startDate and endDate strings for Google Calendar
  let startDate = '';
  let endDate = '';
  
  if (eventDate) {
    if (startTime) {
      // Add time to date to create an ISO date string
      startDate = `${eventDate}T${startTime.padStart(5, '0')}:00`;
    } else {
      startDate = eventDate; // Use just the date for all-day events
    }
    
    // Set endDate if endTime exists, otherwise use startDate
    if (endTime) {
      endDate = `${eventDate}T${endTime.padStart(5, '0')}:00`;
    } else {
      // For all-day events, end date can be the same as start date
      endDate = startDate;
    }
  }
  
  // Smart type detection
  let eventType = event.type || '';
  if (!eventType) {
    const titleLower = title.toLowerCase();
    const descLower = (event.description || '').toLowerCase();
    
    if (titleLower.includes('exam') || titleLower.includes('test') || 
        titleLower.includes('quiz') || titleLower.includes('final')) {
      eventType = 'exam';
    } else if (titleLower.includes('assignment') || titleLower.includes('due') || 
              titleLower.includes('submit') || titleLower.includes('paper') ||
              titleLower.includes('essay') || descLower.includes('due')) {
      eventType = 'assignment';
    } else if (titleLower.includes('discuss') || 
              descLower.includes('discuss') || descLower.includes('reading')) {
      eventType = 'discussion';
    } else if (descLower.includes('p.') || descLower.match(/pp\.\s*\d+/) || 
               descLower.includes('chapter') || descLower.includes('page')) {
      eventType = 'reading';
    } else {
      eventType = 'class';
    }
  }
  
  // Return a clean, standardized event object
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
    type: eventType
  };
}

export async function POST(request: NextRequest) {
  console.log('Extract events API route called');
  
  try {
    const formData = await request.formData();
    const fileEntries = Array.from(formData.entries()).filter(([key]) => key.startsWith('file'));
    
    console.log(`Received ${fileEntries.length} files for processing`);
    
    if (fileEntries.length === 0) {
      console.log('No files provided in the request');
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    console.log(`Processing ${fileEntries.length} files...`);
    
    // Process each file and collect all events
    const allEvents = [];
    const errors = [];
    
    for (const [_, file] of fileEntries) {
      if (!(file instanceof File)) {
        console.warn('Skipping non-file entry');
        continue;
      }
      
      let base64Image = '';
      const fileName = file.name;
      const fileType = file.type;

      console.log('Processing file:', fileName, 'of type:', fileType);

      // Handle different file types
      try {
        if (fileType.startsWith('image/')) {
          // Process image file
          const buffer = await file.arrayBuffer();
          base64Image = Buffer.from(buffer).toString('base64');
          console.log('Processed image file, base64 length:', base64Image.length);
        } else if (fileType === 'application/pdf') {
          // Process PDF file - convert first page to image
          console.log('Processing PDF file...');
          const buffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: buffer }).promise;
          const page = await pdf.getPage(1);
          
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = new OffscreenCanvas(viewport.width, viewport.height);
          const context = canvas.getContext('2d');
          
          if (!context) {
            throw new Error('Could not create canvas context');
          }
          
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
          const arrayBuffer = await blob.arrayBuffer();
          base64Image = Buffer.from(arrayBuffer).toString('base64');
          console.log('Processed PDF file, base64 length:', base64Image.length);
        } else {
          throw new Error(`Unsupported file type: ${fileType}`);
        }
      } catch (fileError) {
        console.error(`Error processing file ${fileName}:`, fileError);
        errors.push({
          file: fileName,
          error: fileError.message || 'Failed to process file'
        });
        continue; // Skip this file but continue with others
      }

      if (!base64Image) {
        console.warn(`No image data extracted from ${fileName}`);
        errors.push({
          file: fileName,
          error: 'Failed to extract image data'
        });
        continue;
      }

      // Extract events using OpenAI Vision API
      try {
        console.log(`Extracting events from ${fileName}...`);
        const extractedEvents = await extractEventsFromImage(base64Image);
        
        if (!extractedEvents || !Array.isArray(extractedEvents)) {
          console.warn(`No valid events extracted from ${fileName}`);
          errors.push({
            file: fileName,
            error: 'No valid events extracted'
          });
          continue;
        }
        
        console.log(`Extracted ${extractedEvents.length} events from ${fileName}`);
        
        // Process events to ensure they have valid structure
        const processedEvents = extractedEvents
          .filter(event => event && typeof event === 'object' && event.title)
          .map(event => processEvent(event));
        
        console.log(`Processed ${processedEvents.length} valid events`);
        
        // Add file info to each event
        const eventsWithSource = processedEvents.map(event => ({
          ...event,
          sourceFile: fileName,
          sourceFileType: fileType
        }));
        
        allEvents.push(...eventsWithSource);
      } catch (extractError) {
        console.error(`Error extracting events from ${fileName}:`, extractError);
        errors.push({
          file: fileName,
          error: 'Failed to extract events: ' + (extractError.message || 'Unknown error')
        });
      }
    }
    
    console.log(`Total events extracted: ${allEvents.length}`);
    
    // Filter out duplicate events based on title, date, and description
    const uniqueEvents = Array.from(
      new Map(allEvents.map(event => 
        [`${event.title}_${event.date || ''}_${event.description || ''}`, event]
      )).values()
    );
    
    console.log(`After deduplication: ${uniqueEvents.length} events`);
    
    // Return either events or error message
    if (uniqueEvents.length === 0) {
      if (errors.length > 0) {
        return NextResponse.json(
          { 
            message: 'No events could be extracted from the provided files',
            errors
          },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          { message: 'No events found in the provided files' },
          { status: 200 }
        );
      }
    }
    
    return NextResponse.json({ 
      events: uniqueEvents,
      count: uniqueEvents.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error processing files:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process files', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 