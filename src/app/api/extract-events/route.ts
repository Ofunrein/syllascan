import { NextRequest, NextResponse } from 'next/server';
import { extractEventsFromImage } from '@/lib/openai';
import * as pdfjs from 'pdfjs-dist';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canUseDefaultApiKey, getApiKey, incrementApiUsage } from '@/lib/apiKeyManager';

// Initialize PDF.js worker
if (typeof window === 'undefined') {
  // Server-side only
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    // Check if user can use the default API key
    const canUseDefault = await canUseDefaultApiKey(session);
    
    // Get the API key to use (custom or default)
    const apiKey = await getApiKey(session);
    
    // If user has exceeded their free limit and hasn't provided a key
    if (!canUseDefault && !apiKey) {
      return NextResponse.json(
        { 
          error: 'API usage limit reached', 
          message: 'You have used your free limit of 5 extractions. Please provide your own OpenAI API key to continue using this service.',
          requiresKey: true
        },
        { status: 403 }
      );
    }
    
    // If we don't have an API key at all (should not happen with proper configuration)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not available' },
        { status: 500 }
      );
    }
    
    const formData = await request.formData();
    const fileEntries = Array.from(formData.entries()).filter(([key]) => key.startsWith('file'));
    
    if (fileEntries.length === 0) {
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
      if (fileType.startsWith('image/')) {
        // Process image file
        const buffer = await file.arrayBuffer();
        base64Image = Buffer.from(buffer).toString('base64');
        console.log('Processed image file, base64 length:', base64Image.length);
      } else if (fileType === 'application/pdf') {
        // Process PDF file - convert first page to image
        try {
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
        } catch (pdfError) {
          console.error('Error processing PDF:', pdfError);
          errors.push({
            file: fileName,
            error: 'Failed to process PDF file'
          });
          continue; // Skip this file but continue with others
        }
      } else {
        console.warn('Skipping unsupported file type:', fileType);
        errors.push({
          file: fileName,
          error: `Unsupported file type: ${fileType}`
        });
        continue; // Skip this file but continue with others
      }

      // Extract events using OpenAI Vision API
      try {
        console.log(`Extracting events from ${fileName}...`);
        const events = await extractEventsFromImage(base64Image, apiKey);
        console.log(`Extracted ${events.length} events from ${fileName}`);
        
        // Add file info to each event
        const eventsWithSource = events.map(event => ({
          ...event,
          sourceFile: fileName,
          sourceFileType: fileType
        }));
        
        allEvents.push(...eventsWithSource);
      } catch (extractError) {
        console.error(`Error extracting events from ${fileName}:`, extractError);
        
        // Check for specific OpenAI API errors
        let errorMessage = 'Failed to extract events';
        let requiresKey = false;
        
        if (extractError.response?.status === 429) {
          errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
          if (!session?.user?.email || !canUseDefault) {
            errorMessage = 'OpenAI API rate limit exceeded. Please provide your own API key to continue.';
            requiresKey = true;
          }
        } else if (extractError.response?.status === 401) {
          errorMessage = 'OpenAI API key is invalid. Please provide a valid API key.';
          requiresKey = true;
        } else if (extractError.response?.status === 400) {
          errorMessage = 'Bad request to OpenAI API. Please check your input and try again.';
        }
        
        errors.push({
          file: fileName,
          error: errorMessage,
          requiresKey
        });
      }
    }
    
    // Increment the API usage count if using default key
    if (canUseDefault) {
      await incrementApiUsage(session);
    }
    
    console.log(`Total events extracted: ${allEvents.length}`);
    
    if (allEvents.length === 0) {
      const requiresKey = errors.some(e => e.requiresKey);
      
      return NextResponse.json(
        { 
          message: 'No events could be extracted from the provided files',
          errors,
          requiresKey
        },
        { status: 200 }
      );
    }
    
    return NextResponse.json({ 
      events: allEvents,
      count: allEvents.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error processing files:', error);
    return NextResponse.json(
      { error: 'Failed to process files', details: error.toString() },
      { status: 500 }
    );
  }
} 