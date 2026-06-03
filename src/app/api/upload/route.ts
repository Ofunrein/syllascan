import { NextRequest, NextResponse } from 'next/server';
import { extractEventsFromImage, extractEventsFromText } from '@/lib/openai';
import { PDFParse } from 'pdf-parse';

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
      try {
        console.log('Processing PDF file...');
        const buffer = Buffer.from(await file.arrayBuffer());
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const result = await parser.getText();
        const pdfText = result.text;
        await parser.destroy();
        console.log('Extracted PDF text, length:', pdfText.length);
        const events = await extractEventsFromText(pdfText);
        console.log('Extracted events:', events.length);
        return NextResponse.json({ events });
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
      { error: 'Failed to process file', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 