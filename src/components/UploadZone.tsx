import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from './ui/button';
import { Trash2, X, FileText } from 'lucide-react';

interface UploadZoneProps {
  files: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
}

export default function UploadZone({ 
  files, 
  onAddFiles, 
  onRemoveFile, 
  onClearAll 
}: UploadZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onAddFiles(acceptedFiles);
  }, [onAddFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    }
  });

  return (
    <div className="w-full">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary/50'}`}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center space-y-2">
          <FileText className="h-10 w-10 text-gray-400" />
          
          <p className="text-lg font-medium">
            {isDragActive ? 'Drop the files here' : 'Drag & drop files here'}
          </p>
          
          <p className="text-sm text-gray-500">
            or click to browse (PDF, JPG, PNG)
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">
              {files.length} {files.length === 1 ? 'file' : 'files'} selected
            </h3>
            <Button 
              variant="outline" 
              size="sm"
              onClick={onClearAll}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Clear All
            </Button>
          </div>

          <ul className="space-y-2">
            {files.map((file, index) => (
              <li 
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm font-medium truncate max-w-[250px]">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onRemoveFile(index)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 