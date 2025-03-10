import { NextRequest, NextResponse } from 'next/server';
import { extractEventsFromImage } from '@/lib/openai';
import * as pdfjs from 'pdfjs-dist';

// Initialize PDF.js worker
if (typeof window === 'undefined') {
  // Server-side only
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    // We're not using authentication for now
    let uid = 'anonymous';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    let base64Image = '';
    const fileName = file.name;
    const fileType = file.type;

    console.log('Processing file:', fileName, 'of type:', fileType);

    // Handle different file types
    if (file.type.startsWith('image/')) {
      // Process image file
      const buffer = await file.arrayBuffer();
      base64Image = Buffer.from(buffer).toString('base64');
      console.log('Processed image file, base64 length:', base64Image.length);
    } else if (file.type === 'application/pdf') {
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
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
        const arrayBuffer = await blob.arrayBuffer();
        base64Image = Buffer.from(arrayBuffer).toString('base64');
        console.log('Processed PDF file, base64 length:', base64Image.length);
      } catch (pdfError) {
        console.error('Error processing PDF:', pdfError);
        return NextResponse.json(
          { error: 'Failed to process PDF file' },
          { status: 500 }
        );
      }
    } else {
      console.error('Unsupported file type:', fileType);
      return NextResponse.json(
        { error: 'File must be an image or PDF' },
        { status: 400 }
      );
    }

    // Extract events using OpenAI Vision API
    console.log('Extracting events from image...');
    const events = await extractEventsFromImage(base64Image);
    console.log('Extracted events:', events.length);
    
    // We're not storing processing history for now
    
    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json(
      { error: 'Failed to process file', details: error.toString() },
      { status: 500 }
    );
  }
} 