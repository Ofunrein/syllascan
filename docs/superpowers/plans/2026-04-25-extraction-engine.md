# Sub-project 2: Document Extraction Engine Implementation Plan

**Goal:** Fix PDF multi-page bug, add support for Word/PPT/Excel/CSV/TXT/RTF/HTML, upgrade to gpt-5.4-mini, fix MIME type and date bugs.

**Architecture:** File type detection → format-specific conversion (text or images) → gpt-5.4-mini extraction → normalization → dedup → return to client.

---

## Task 1: Install document parsing dependencies

- Install: `mammoth` (docx), `xlsx` (excel/csv)
- No extra dep needed for txt/rtf/html (built-in text extraction)

## Task 2: Rewrite the extraction API route

**File:** `src/app/api/extract-events/route.ts`

Major changes:
- Fix PDF multi-page: render ALL pages, not just page 1
- Fix OffscreenCanvas: use `canvas` npm package for server-side rendering, or extract text via pdfjs getTextContent()
- Add file type routing for docx, pptx, xlsx, csv, txt, rtf, html
- Fix hardcoded image/jpeg MIME type — detect actual MIME
- Fix UTC date shifting
- Upgrade model reference to gpt-5.4-mini

## Task 3: Rewrite the OpenAI extraction module

**File:** `src/lib/openai.ts`

- Change model from gpt-4o to gpt-5.4-mini
- Add `response_format: { type: "json_object" }`
- Support both text and vision inputs (text for docx/txt/etc, vision for images/PDF pages)
- Enhanced prompt with academic context, recurring event detection, confidence scoring
- Multi-image support for multi-page PDFs

## Task 4: Add document conversion utilities

**File:** `src/lib/documentConverter.ts` (new)

Format-specific conversion functions:
- PDF → array of page images (base64) via pdfjs + canvas
- DOCX → text via mammoth
- XLSX/CSV → structured text via xlsx library
- TXT/RTF/HTML → direct text extraction
- Images → base64 with correct MIME type

## Task 5: Update FileUploader to accept new file types

**File:** `src/components/FileUploader.tsx`

- Add accepted types: .docx, .pptx, .xlsx, .csv, .txt, .rtf, .html
- Update UI text to reflect supported formats

## Task 6: Verify and commit
