import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Event } from '@/lib/openai';
import toast from 'react-hot-toast';
import { convertPdfToImage, getPdfPageCount } from '@/utils/pdfUtils';
import { useAuth } from '@/components/AuthProvider';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';

interface FileUploaderProps {
  onEventsExtracted: (events: Event[]) => void;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
  onRequireAuth?: () => void;
}

interface FileWithPreview {
  file: File;
  preview: string | null;
  fileType: 'image' | 'pdf' | 'text' | null;
  pdfPageCount: number;
  currentPdfPage: number;
  isLoading: boolean;
}

export default function FileUploader({
  onEventsExtracted,
  isProcessing,
  setIsProcessing,
  onRequireAuth,
}: FileUploaderProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [mounted, setMounted] = useState(false);
  const { user, authenticated } = useAuth();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const createPreview = useCallback(async (selectedFile: File): Promise<FileWithPreview> => {
    // Images — generate preview in browser
    if (selectedFile.type.startsWith('image/') && selectedFile.type !== 'image/heic' && selectedFile.type !== 'image/heif') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          file: selectedFile,
          preview: reader.result as string,
          fileType: 'image',
          pdfPageCount: 0,
          currentPdfPage: 1,
          isLoading: false,
        });
        reader.onerror = () => resolve({
          file: selectedFile, preview: null, fileType: 'image',
          pdfPageCount: 0, currentPdfPage: 1, isLoading: false,
        });
        reader.readAsDataURL(selectedFile);
      });
    }

    // PDFs — render page 1 via pdfjs
    if (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')) {
      try {
        const [imageDataUrl, pageCount] = await Promise.all([
          convertPdfToImage(selectedFile, 1),
          getPdfPageCount(selectedFile),
        ]);
        return {
          file: selectedFile,
          preview: imageDataUrl,
          fileType: 'pdf',
          pdfPageCount: pageCount,
          currentPdfPage: 1,
          isLoading: false,
        };
      } catch {
        return {
          file: selectedFile, preview: null, fileType: 'pdf',
          pdfPageCount: 0, currentPdfPage: 1, isLoading: false,
        };
      }
    }

    // Text-based files — read first 1200 chars for preview
    const textExts = ['txt', 'md', 'csv', 'html', 'htm', 'rtf', 'gdoc', 'ics', 'ical'];
    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() ?? '';
    const isTextFile = selectedFile.type.startsWith('text/') || textExts.includes(fileExt);
    if (isTextFile) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const text = (reader.result as string).slice(0, 1200);
          resolve({
            file: selectedFile,
            preview: text,
            fileType: 'text',
            pdfPageCount: 0,
            currentPdfPage: 1,
            isLoading: false,
          });
        };
        reader.onerror = () => resolve({
          file: selectedFile, preview: null, fileType: 'text',
          pdfPageCount: 0, currentPdfPage: 1, isLoading: false,
        });
        reader.readAsText(selectedFile);
      });
    }

    // All other document types — no browser preview
    return {
      file: selectedFile,
      preview: null,
      fileType: null,
      pdfPageCount: 0,
      currentPdfPage: 1,
      isLoading: false,
    };
  }, []);

  // Clipboard paste — after createPreview is declared to avoid TDZ
  useEffect(() => {
    if (!mounted) return;
    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const pastedFiles: File[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) pastedFiles.push(f);
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        const newPreviews = await Promise.all(pastedFiles.map(f => createPreview(f)));
        setFiles(prev => [...prev, ...newPreviews]);
        toast.success(`Pasted ${pastedFiles.length} file${pastedFiles.length > 1 ? 's' : ''}`);
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [mounted, createPreview]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    try {
      const newFiles = await Promise.all(acceptedFiles.map(f => createPreview(f)));
      setFiles(prev => {
        const updated = [...prev, ...newFiles];
        setActiveFileIndex(prev.length); // index of first newly added file
        return updated;
      });
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Error processing files');
    }
  }, [createPreview]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // No strict accept filter — rely on extension matching, reject only truly unsupported
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.heic', '.heif'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/msword': ['.doc'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt', '.md'],
      'text/html': ['.html', '.htm'],
      'application/rtf': ['.rtf'],
      'text/calendar': ['.ics', '.ical'],
      'application/octet-stream': ['.pdf', '.docx', '.pptx', '.xlsx', '.ics'], // fallback for wrong MIME
    },
    onDropRejected: (rejections) => {
      const names = rejections.map(r => r.file.name).join(', ');
      toast.error(`Could not add: ${names}. Try dragging directly from your file manager.`);
    },
    maxFiles: 10,
    maxSize: 20971520,
    noClick: !mounted,
    noDrag: !mounted,
  });

  const handlePdfPageChange = useCallback(async (fileIndex: number, newPage: number) => {
    const file = files[fileIndex];
    if (!file || file.fileType !== 'pdf' || newPage < 1 || newPage > file.pdfPageCount) {
      return;
    }

    try {
      setFiles(prevFiles => {
        const updatedFiles = [...prevFiles];
        updatedFiles[fileIndex] = {
          ...updatedFiles[fileIndex],
          isLoading: true
        };
        return updatedFiles;
      });

      const imageDataUrl = await convertPdfToImage(file.file, newPage);

      setFiles(prevFiles => {
        const updatedFiles = [...prevFiles];
        updatedFiles[fileIndex] = {
          ...updatedFiles[fileIndex],
          preview: imageDataUrl,
          currentPdfPage: newPage,
          isLoading: false
        };
        return updatedFiles;
      });
    } catch (error) {
      console.error('Error changing PDF page:', error);
      toast.error('Error changing PDF page');

      setFiles(prevFiles => {
        const updatedFiles = [...prevFiles];
        updatedFiles[fileIndex] = {
          ...updatedFiles[fileIndex],
          isLoading: false
        };
        return updatedFiles;
      });
    }
  }, [files]);

  const removeFile = useCallback((index: number) => {
    setFiles(prevFiles => {
      const newFiles = prevFiles.filter((_, i) => i !== index);
      if (activeFileIndex >= newFiles.length && newFiles.length > 0) {
        setActiveFileIndex(newFiles.length - 1);
      } else if (newFiles.length === 0) {
        setActiveFileIndex(0);
      }
      return newFiles;
    });
  }, [activeFileIndex]);

  const extractEvents = useCallback(async () => {
    if (files.length === 0) {
      toast.error('Please upload at least one file');
      return;
    }

    if (!authenticated && onRequireAuth) {
      onRequireAuth();
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading('Processing files...');

    try {
      // Prepare the files for upload
      const formData = new FormData();
      files.forEach((fileWithPreview, index) => {
        formData.append(`file${index}`, fileWithPreview.file);
      });

      // Send the files to the server
      const response = await fetch('/api/extract-events', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to extract events');
      }

      const data = await response.json();

      if (data.events && Array.isArray(data.events) && data.events.length > 0) {
        onEventsExtracted(data.events);
        toast.success(`Successfully extracted ${data.events.length} events`, { id: toastId });
      } else if (data.errors?.length > 0) {
        // Show the actual server error so we know what went wrong
        toast.error(`Extraction failed: ${data.errors[0].error}`, { id: toastId, duration: 6000 });
      } else {
        toast.error(data.message || 'No events found in the uploaded files', { id: toastId });
      }
    } catch (error) {
      console.error('Error extracting events:', error);
      toast.error('Error extracting events', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  }, [files, setIsProcessing, onEventsExtracted, authenticated, onRequireAuth]);

  const clearAllFiles = useCallback(() => {
    setFiles([]);
    setActiveFileIndex(0);
  }, []);

  // Clean up previews when component unmounts
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  const activeFile = files[activeFileIndex];

  // SSR skeleton
  if (!mounted) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="rounded-xl border border-white/8 bg-white/3 p-6 space-y-4">
          <div className="h-5 w-40 rounded-md bg-white/8 animate-pulse" />
          <div className="h-48 rounded-xl bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {files.length === 0 ? (
        /* ── Empty state: full drag-drop zone ── */
        <div
          {...getRootProps()}
          className={`dropzone ${isDragActive ? 'dropzone--active' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="dropzone-inner">
            <div className="dropzone-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="dropzone-title">
              {isDragActive ? 'Drop to upload' : 'Drop files or click to browse'}
            </p>
            <p className="dropzone-sub">PDF, Word, Excel, PowerPoint, images, CSV, text · max 10 MB</p>
          </div>
        </div>
      ) : (
        /* ── Files loaded state ── */
        <div className="files-panel">
          {/* Header bar */}
          <div className="files-header">
            <span className="files-count">{files.length} {files.length === 1 ? 'file' : 'files'}</span>
            <div className="files-actions">
              <div {...getRootProps()} className="action-link">
                <input {...getInputProps()} />
                <PlusIcon className="action-icon" />
                Add files
              </div>
              <button type="button" onClick={clearAllFiles} className="action-link action-link--danger">
                <TrashIcon className="action-icon" />
                Clear all
              </button>
            </div>
          </div>

          {/* File list */}
          <ul className="file-list">
            {files.map((file, index) => {
              const ext = file.file.name.split('.').pop()?.toUpperCase() ?? 'FILE';
              const isActive = index === activeFileIndex;
              return (
                <li
                  key={`${file.file.name}-${index}`}
                  className={`file-row ${isActive ? 'file-row--active' : ''}`}
                  onClick={() => setActiveFileIndex(index)}
                >
                  {/* Thumbnail */}
                  <div className="file-thumb">
                    {file.isLoading ? (
                      <div className="thumb-skeleton" />
                    ) : file.preview ? (
                      <img src={file.preview} alt="" className="thumb-img" />
                    ) : (
                      <span className="thumb-ext">{ext}</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="file-info">
                    <span className="file-name" title={file.file.name}>{file.file.name}</span>
                    <span className="file-size">{(file.file.size / 1024).toFixed(0)} KB</span>
                  </div>
                  {/* Remove */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                    className="file-remove"
                    disabled={isProcessing}
                    aria-label="Remove file"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Preview pane for active file */}
          {activeFile && (activeFile.preview || activeFile.isLoading || activeFile.fileType === null) && (
            <div className="preview-pane">
              {activeFile.isLoading ? (
                <div className="preview-skeleton" />
              ) : activeFile.fileType === null || (!activeFile.preview && activeFile.fileType !== 'text') ? (
                <div className="preview-no-preview">
                  <span className="preview-no-ext">{activeFile.file.name.split('.').pop()?.toUpperCase()}</span>
                  <span className="preview-no-label">No preview available</span>
                </div>
              ) : activeFile.fileType === 'text' ? (
                <pre className="preview-text">{activeFile.preview}</pre>
              ) : (
                <>
                  <img src={activeFile.preview!} alt={activeFile.file.name} className="preview-img" />
                  {activeFile.fileType === 'pdf' && activeFile.pdfPageCount > 1 && (
                    <div className="pdf-nav">
                      <button
                        type="button"
                        onClick={() => handlePdfPageChange(activeFileIndex, activeFile.currentPdfPage - 1)}
                        disabled={activeFile.currentPdfPage <= 1 || isProcessing}
                        className="pdf-nav-btn"
                      >‹</button>
                      <span className="pdf-nav-label">
                        {activeFile.currentPdfPage} / {activeFile.pdfPageCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePdfPageChange(activeFileIndex, activeFile.currentPdfPage + 1)}
                        disabled={activeFile.currentPdfPage >= activeFile.pdfPageCount || isProcessing}
                        className="pdf-nav-btn"
                      >›</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Extract CTA */}
          <div className="extract-wrap">
            <button
              type="button"
              onClick={extractEvents}
              disabled={files.length === 0 || isProcessing}
              className="extract-btn"
            >
              {isProcessing ? (
                <>
                  <svg className="spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Extracting…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                  Extract Events
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ── Drop zone ── */
        .dropzone {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 260px;
          border: 1.5px dashed rgba(255,255,255,0.18);
          border-radius: 1rem;
          background: rgba(255,255,255,0.025);
          cursor: pointer;
          transition: border-color 0.25s, background 0.25s;
        }
        .dropzone:hover, .dropzone--active {
          border-color: rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.05);
        }
        .dropzone--active {
          border-style: solid;
          border-color: rgba(255,255,255,0.65);
        }
        .dropzone-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          text-align: center;
          padding: 2rem;
          pointer-events: none;
        }
        .dropzone-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.25rem;
        }
        .dropzone-icon svg { width: 26px; height: 26px; color: rgba(255,255,255,0.75); }
        .dropzone-title { font-size: 1rem; font-weight: 600; color: #fff; }
        .dropzone-sub { font-size: 0.8125rem; color: rgba(255,255,255,0.4); max-width: 320px; }

        /* ── Files panel ── */
        .files-panel {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 1rem;
          background: rgba(255,255,255,0.025);
          overflow: hidden;
        }

        /* Header */
        .files-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.875rem 1.25rem;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .files-count {
          font-size: 0.8125rem;
          font-weight: 600;
          color: rgba(255,255,255,0.55);
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .files-actions { display: flex; align-items: center; gap: 1.25rem; }
        .action-link {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: rgba(255,255,255,0.55);
          cursor: pointer;
          transition: color 0.15s;
          background: none;
          border: none;
          padding: 0;
        }
        .action-link:hover { color: rgba(255,255,255,0.9); }
        .action-link--danger { color: rgba(239,68,68,0.65); }
        .action-link--danger:hover { color: rgb(239,68,68); }
        .action-icon { width: 13px; height: 13px; }

        /* File list */
        .file-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .file-row {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 0.75rem 1.25rem;
          cursor: pointer;
          transition: background 0.15s;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .file-row:last-child { border-bottom: none; }
        .file-row:hover { background: rgba(255,255,255,0.04); }
        .file-row--active { background: rgba(255,255,255,0.06); }

        .file-thumb {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }
        .thumb-img { width: 100%; height: 100%; object-fit: cover; }
        .thumb-ext { font-size: 0.6rem; font-weight: 700; color: rgba(255,255,255,0.5); letter-spacing: 0.05em; }
        .thumb-skeleton { width: 100%; height: 100%; background: rgba(255,255,255,0.1); animation: pulse 1.2s infinite; }

        .file-info { flex: 1; min-width: 0; }
        .file-name {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: rgba(255,255,255,0.9);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .file-size { font-size: 0.75rem; color: rgba(255,255,255,0.35); }

        .file-remove {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: none;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: rgba(255,255,255,0.25);
          transition: color 0.15s, background 0.15s;
          flex-shrink: 0;
        }
        .file-remove:hover { color: rgb(239,68,68); background: rgba(239,68,68,0.1); }
        .file-remove svg { width: 14px; height: 14px; }

        /* Preview */
        .preview-pane {
          border-top: 1px solid rgba(255,255,255,0.07);
          background: rgba(0,0,0,0.2);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }
        .preview-skeleton {
          width: 100%;
          height: 180px;
          border-radius: 0.75rem;
          background: rgba(255,255,255,0.06);
          animation: pulse 1.2s infinite;
        }
        .preview-img {
          max-height: 220px;
          max-width: 100%;
          object-fit: contain;
          border-radius: 0.5rem;
        }
        .preview-text {
          width: 100%;
          max-height: 200px;
          overflow-y: auto;
          font-size: 0.75rem;
          line-height: 1.5;
          color: rgba(255,255,255,0.7);
          white-space: pre-wrap;
          word-break: break-word;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 0.5rem;
          padding: 0.75rem;
          font-family: ui-monospace, monospace;
          margin: 0;
        }
        .preview-no-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1.5rem 0;
        }
        .preview-no-ext {
          font-size: 1.25rem;
          font-weight: 700;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.1em;
          font-family: ui-monospace, monospace;
        }
        .preview-no-label {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.25);
        }

        /* PDF nav */
        .pdf-nav { display: flex; align-items: center; gap: 0.75rem; }
        .pdf-nav-btn {
          width: 28px; height: 28px;
          border-radius: 6px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.14);
          color: white;
          font-size: 1.1rem;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.15s;
        }
        .pdf-nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.18); }
        .pdf-nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .pdf-nav-label { font-size: 0.8125rem; color: rgba(255,255,255,0.5); }

        /* Extract CTA */
        .extract-wrap {
          padding: 1.25rem;
          border-top: 1px solid rgba(255,255,255,0.07);
          display: flex;
          justify-content: center;
        }
        .extract-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 2rem;
          background: white;
          color: #0a0a0f;
          font-size: 0.9375rem;
          font-weight: 600;
          border-radius: 9999px;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.2s;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.2), 0 8px 24px rgba(0,0,0,0.4);
        }
        .extract-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .extract-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .extract-btn svg { width: 16px; height: 16px; }
        .spin { animation: spin 0.8s linear infinite; }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
