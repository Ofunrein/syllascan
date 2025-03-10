import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Event } from '@/lib/openai';
import toast from 'react-hot-toast';
import { convertPdfToImage, getPdfPageCount } from '@/utils/pdfUtils';
import { useUser } from '@/lib/UserContext';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface FileUploaderProps {
  onEventsExtracted: (events: Event[]) => void;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
}

interface FileWithPreview {
  file: File;
  preview: string | null;
  fileType: 'image' | 'pdf' | null;
  pdfPageCount: number;
  currentPdfPage: number;
  isLoading: boolean;
}

export default function FileUploader({ 
  onEventsExtracted, 
  isProcessing, 
  setIsProcessing 
}: FileUploaderProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const { user, authenticated } = useUser();

  const createPreview = useCallback(async (selectedFile: File): Promise<FileWithPreview> => {
    try {
      if (selectedFile.type.startsWith('image/')) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              file: selectedFile,
              preview: reader.result as string,
              fileType: 'image',
              pdfPageCount: 0,
              currentPdfPage: 1,
              isLoading: false
            });
          };
          reader.readAsDataURL(selectedFile);
        });
      } else if (selectedFile.type === 'application/pdf') {
        const filePreview: FileWithPreview = {
          file: selectedFile,
          preview: null,
          fileType: 'pdf',
          pdfPageCount: 0,
          currentPdfPage: 1,
          isLoading: true
        };
        
        try {
          // Get the page count first
          const pageCount = await getPdfPageCount(selectedFile);
          filePreview.pdfPageCount = pageCount;
          
          // Then convert the first page to an image
          if (pageCount > 0) {
            const imageDataUrl = await convertPdfToImage(selectedFile, 1);
            filePreview.preview = imageDataUrl;
          }
        } catch (error) {
          console.error('Error processing PDF:', error);
          toast.error('Error processing PDF file');
        } finally {
          filePreview.isLoading = false;
        }
        
        return filePreview;
      } else {
        throw new Error('Unsupported file type');
      }
    } catch (error) {
      console.error('Error creating preview:', error);
      toast.error('Error creating file preview');
      return {
        file: selectedFile,
        preview: null,
        fileType: null,
        pdfPageCount: 0,
        currentPdfPage: 1,
        isLoading: false
      };
    }
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    try {
      const newFiles = await Promise.all(
        acceptedFiles.map(file => createPreview(file))
      );
      
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
      setActiveFileIndex(prevFiles => prevFiles.length);
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Error processing files');
    }
  }, [createPreview]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'application/pdf': []
    },
    maxFiles: 10,
    maxSize: 10485760, // 10MB
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
      } else {
        toast.error('No events found in the uploaded files', { id: toastId });
      }
    } catch (error) {
      console.error('Error extracting events:', error);
      toast.error('Error extracting events', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  }, [files, setIsProcessing, onEventsExtracted]);

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

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Upload Your Documents</h2>
        </div>
        
        {files.length === 0 ? (
          <div 
            {...getRootProps()} 
            className="upload-dropzone"
            style={{ minHeight: '300px' }}
          >
            <input {...getInputProps()} />
            
            <div className="upload-content">
              <div className="upload-icon-container">
                <svg xmlns="http://www.w3.org/2000/svg" className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="upload-text">
                <h3 className="upload-title">Drop files here or click to upload</h3>
                <p className="upload-description">
                  Supports JPG, PNG, GIF, and PDF files (max 10MB, up to 10 files)
                </p>
              </div>
              <button
                type="button"
                className="upload-button"
              >
                Browse Files
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* File management buttons */}
            <div className="file-management-buttons">
              <div {...getRootProps()} className="add-more-button">
                <input {...getInputProps()} />
                <PlusIcon className="button-icon" />
                <span>Add More Files</span>
              </div>
              
              <button 
                type="button" 
                onClick={clearAllFiles}
                className="clear-all-button"
              >
                <TrashIcon className="button-icon" />
                <span>Clear All</span>
              </button>
            </div>
            
            {/* File thumbnails row */}
            <div className="flex flex-wrap gap-2 mb-4">
              {files.map((file, index) => (
                <div 
                  key={`${file.file.name}-${index}`}
                  onClick={() => setActiveFileIndex(index)}
                  className={`file-thumbnail ${index === activeFileIndex ? 'active' : ''}`}
                >
                  {file.isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                  ) : file.preview ? (
                    <img 
                      src={file.preview} 
                      alt={`Preview of ${file.file.name}`}
                      className="object-contain w-full h-full p-1"
                    />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="file-remove-button"
                    disabled={isProcessing}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            
            {/* Active file preview */}
            {activeFile && (
              <div className="file-preview">
                <div className="file-preview-header">
                  <h3 className="file-preview-title" title={activeFile.file.name}>
                    {activeFile.file.name}
                  </h3>
                  <span className="file-preview-size">
                    {(activeFile.file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                
                {activeFile.isLoading ? (
                  <div className="file-preview-loading">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading preview...</p>
                  </div>
                ) : activeFile.preview ? (
                  <div className="space-y-2">
                    <div className="file-preview-image-container">
                      <img 
                        src={activeFile.preview} 
                        alt={`Preview of ${activeFile.file.name}`}
                        className="file-preview-image" 
                      />
                    </div>
                    
                    {activeFile.fileType === 'pdf' && activeFile.pdfPageCount > 1 && (
                      <div className="pdf-navigation">
                        <button
                          type="button"
                          onClick={() => handlePdfPageChange(activeFileIndex, activeFile.currentPdfPage - 1)}
                          disabled={activeFile.currentPdfPage <= 1 || isProcessing}
                          className="pdf-nav-button"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        <span className="pdf-page-indicator">
                          Page {activeFile.currentPdfPage} of {activeFile.pdfPageCount}
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => handlePdfPageChange(activeFileIndex, activeFile.currentPdfPage + 1)}
                          disabled={activeFile.currentPdfPage >= activeFile.pdfPageCount || isProcessing}
                          className="pdf-nav-button"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="file-preview-empty">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No preview available</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Extract button - styled like the navigation tabs */}
            <div className="extract-button-container">
              <button
                type="button"
                onClick={extractEvents}
                disabled={files.length === 0 || isProcessing}
                className="extract-button"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Extract Events
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <style jsx>{`
          .upload-dropzone {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            border: 2px dashed var(--border);
            border-radius: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            background-color: rgba(var(--primary-rgb), 0.02);
          }
          
          .upload-dropzone:hover {
            border-color: var(--primary);
            background-color: rgba(var(--primary-rgb), 0.05);
          }
          
          .upload-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            max-width: 400px;
          }
          
          .upload-icon-container {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.1), rgba(var(--primary-rgb), 0.2));
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1.5rem;
            box-shadow: 0 4px 6px rgba(var(--primary-rgb), 0.1);
          }
          
          .upload-icon {
            width: 40px;
            height: 40px;
            color: var(--primary);
          }
          
          .upload-text {
            margin-bottom: 1.5rem;
          }
          
          .upload-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--foreground);
            margin-bottom: 0.5rem;
          }
          
          .upload-description {
            font-size: 0.875rem;
            color: var(--foreground);
            opacity: 0.7;
          }
          
          .upload-button {
            padding: 0.625rem 1.25rem;
            background-color: var(--primary);
            color: white;
            font-weight: 500;
            border-radius: 0.5rem;
            transition: all 0.2s;
            border: none;
            box-shadow: 0 2px 4px rgba(var(--primary-rgb), 0.3);
          }
          
          .upload-button:hover {
            background-color: var(--primary-dark);
            transform: translateY(-1px);
            box-shadow: 0 4px 6px rgba(var(--primary-rgb), 0.4);
          }
          
          .file-thumbnail {
            position: relative;
            width: 70px;
            height: 70px;
            border-radius: 0.5rem;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--border);
            cursor: pointer;
            transition: all 0.2s;
            background-color: var(--card);
          }
          
          .file-thumbnail.active {
            border-color: var(--primary);
            box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.3);
          }
          
          .file-thumbnail:hover {
            transform: translateY(-2px);
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
          }
          
          .file-remove-button {
            position: absolute;
            top: 0;
            right: 0;
            background-color: rgba(239, 68, 68, 0.9);
            color: white;
            border-radius: 0 0 0 0.375rem;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s;
            border: none;
          }
          
          .file-thumbnail:hover .file-remove-button {
            opacity: 1;
          }
          
          .add-file-button {
            width: 70px;
            height: 70px;
            border-radius: 0.5rem;
            border: 1px dashed var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
            background-color: rgba(var(--primary-rgb), 0.02);
          }
          
          .add-file-button:hover {
            border-color: var(--primary);
            background-color: rgba(var(--primary-rgb), 0.05);
          }
          
          .file-preview {
            border-radius: 0.75rem;
            overflow: hidden;
            background-color: var(--card);
            border: 1px solid var(--border);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          }
          
          .file-preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1rem;
            border-bottom: 1px solid var(--border);
            background-color: rgba(var(--primary-rgb), 0.03);
          }
          
          .file-preview-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--foreground);
            max-width: 70%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          .file-preview-size {
            font-size: 0.75rem;
            color: var(--foreground);
            opacity: 0.7;
          }
          
          .file-preview-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            gap: 1rem;
          }
          
          .file-preview-image-container {
            display: flex;
            justify-content: center;
            padding: 1rem;
            background-color: white;
            border-radius: 0.5rem;
            margin: 1rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          
          .file-preview-image {
            max-height: 200px;
            max-width: 100%;
            object-fit: contain;
          }
          
          .file-preview-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            background-color: rgba(var(--primary-rgb), 0.02);
            margin: 1rem;
            border-radius: 0.5rem;
          }
          
          .pdf-navigation {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            padding: 0.5rem;
            margin: 0 1rem 1rem;
            background-color: rgba(var(--primary-rgb), 0.05);
            border-radius: 0.5rem;
          }
          
          .pdf-nav-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: white;
            color: var(--primary);
            border: 1px solid var(--border);
            transition: all 0.2s;
          }
          
          .pdf-nav-button:hover:not(:disabled) {
            background-color: var(--primary);
            color: white;
          }
          
          .pdf-nav-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .pdf-page-indicator {
            font-size: 0.75rem;
            font-weight: 500;
            color: var(--foreground);
          }
          
          .extract-button-container {
            display: flex;
            justify-content: center;
            margin-top: 1.5rem;
          }
          
          .extract-button {
            display: inline-flex;
            align-items: center;
            padding: 0.75rem 1.5rem;
            background-color: var(--primary);
            color: white;
            font-weight: 500;
            border-radius: 0.5rem;
            transition: all 0.3s;
            border: none;
            box-shadow: 0 2px 4px rgba(var(--primary-rgb), 0.3);
          }
          
          .extract-button:hover:not(:disabled) {
            background-color: var(--primary-dark);
            transform: translateY(-1px);
            box-shadow: 0 4px 6px rgba(var(--primary-rgb), 0.4);
          }
          
          .extract-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          
          .file-management-buttons {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
          }
          
          .add-more-button {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background-color: rgba(var(--primary-rgb), 0.1);
            color: var(--primary);
            font-size: 0.875rem;
            font-weight: 500;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
          }
          
          .add-more-button:hover {
            background-color: rgba(var(--primary-rgb), 0.15);
            transform: translateY(-1px);
          }
          
          .clear-all-button {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background-color: rgba(239, 68, 68, 0.1);
            color: rgb(239, 68, 68);
            font-size: 0.875rem;
            font-weight: 500;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
          }
          
          .clear-all-button:hover {
            background-color: rgba(239, 68, 68, 0.15);
            transform: translateY(-1px);
          }
          
          .button-icon {
            width: 1rem;
            height: 1rem;
          }
        `}</style>
      </div>
    </div>
  );
} 