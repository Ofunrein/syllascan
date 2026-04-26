import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface ConvertedContent {
  type: 'text' | 'images';
  text?: string;
  images?: { base64: string; mimeType: string }[];
  pageCount: number;
}

export async function convertDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ConvertedContent> {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (mimeType.startsWith('image/')) {
    return {
      type: 'images',
      images: [{ base64: buffer.toString('base64'), mimeType }],
      pageCount: 1,
    };
  }

  switch (ext) {
    case 'pdf':
      return convertPdf(buffer);
    case 'docx':
      return convertDocx(buffer);
    case 'xlsx':
    case 'xls':
      return convertExcel(buffer);
    case 'csv':
      return convertCsv(buffer);
    case 'pptx':
      return convertPptx(buffer);
    case 'txt':
    case 'rtf':
    case 'html':
    case 'htm':
      return convertText(buffer);
    default:
      // Try as text fallback
      return convertText(buffer);
  }
}

async function convertPdf(buffer: Buffer): Promise<ConvertedContent> {
  const uint8 = new Uint8Array(buffer);
  // disableWorker: true runs pdfjs inline without spawning a worker thread.
  // Required for serverless (Vercel Lambda) — file:// worker URLs don't work there.
  const pdf = await getDocument({ data: uint8, useSystemFonts: true, disableWorker: true }).promise;
  const numPages = pdf.numPages;
  const allText: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ');
    allText.push(`--- Page ${i} ---\n${pageText}`);
  }

  const fullText = allText.join('\n\n');

  // If we got meaningful text, use text mode (faster + cheaper)
  if (fullText.replace(/\s+/g, '').length > 100) {
    return { type: 'text', text: fullText, pageCount: numPages };
  }

  // Fallback: PDF is image-based (scanned), send as images
  return {
    type: 'images',
    images: [{ base64: buffer.toString('base64'), mimeType: 'application/pdf' }],
    pageCount: numPages,
  };
}

async function convertDocx(buffer: Buffer): Promise<ConvertedContent> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    type: 'text',
    text: result.value,
    pageCount: Math.max(1, Math.ceil(result.value.length / 3000)),
  };
}

function convertExcel(buffer: Buffer): ConvertedContent {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const allText: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    allText.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }

  const text = allText.join('\n\n');
  return { type: 'text', text, pageCount: workbook.SheetNames.length };
}

function convertCsv(buffer: Buffer): ConvertedContent {
  const text = buffer.toString('utf-8');
  return { type: 'text', text, pageCount: 1 };
}

async function convertPptx(buffer: Buffer): Promise<ConvertedContent> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const slideTexts: string[] = [];

    const slideFiles = Object.keys(zip.files)
      .filter(name => name.match(/ppt\/slides\/slide\d+\.xml$/))
      .sort();

    for (const slideFile of slideFiles) {
      const content = await zip.files[slideFile].async('string');
      const texts = content.match(/<a:t>([^<]*)<\/a:t>/g);
      if (texts) {
        const slideText = texts.map(t => t.replace(/<\/?a:t>/g, '')).join(' ');
        const slideNum = slideFile.match(/slide(\d+)/)?.[1];
        slideTexts.push(`--- Slide ${slideNum} ---\n${slideText}`);
      }
    }

    const text = slideTexts.join('\n\n');
    return { type: 'text', text, pageCount: slideFiles.length || 1 };
  } catch {
    return { type: 'text', text: buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' '), pageCount: 1 };
  }
}

function convertText(buffer: Buffer): ConvertedContent {
  let text = buffer.toString('utf-8');
  if (text.includes('<html') || text.includes('<HTML') || text.includes('<!DOCTYPE')) {
    text = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return { type: 'text', text, pageCount: 1 };
}
