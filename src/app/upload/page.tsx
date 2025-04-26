'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import UploadZone from '@/components/UploadZone';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useEventStore } from '@/lib/stores/eventStore';
import { Event } from '@/lib/openai';

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { setEvents } = useEventStore();
  
  const handleAddFiles = useCallback((newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles]);
    setErrorDetails(null); // Clear any previous errors
  }, []);
  
  const handleClearFiles = useCallback(() => {
    setFiles([]);
    setErrorDetails(null);
  }, []);
  
  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  const handleExtractEvents = async () => {
    if (files.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please upload at least one file to extract events from.',
        variant: 'destructive'
      });
      return;
    }
    
    setIsLoading(true);
    setErrorDetails(null);
    
    try {
      const formData = new FormData();
      
      files.forEach((file, index) => {
        formData.append(`file-${index}`, file);
      });
      
      console.log("Making extraction request...");
      const response = await fetch('/api/extract-events', {
        method: 'POST',
        body: formData,
      });
      
      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);
      
      if (!response.ok) {
        const errorMessage = data.message || data.error || 'Failed to extract events';
        console.error('Extraction error:', data);
        setErrorDetails(JSON.stringify(data, null, 2));
        throw new Error(errorMessage);
      }
      
      if (data.events && data.events.length > 0) {
        // Store events in global store
        setEvents(data.events as Event[]);
        
        // Show success message
        toast({
          title: 'Events extracted successfully',
          description: `Found ${data.events.length} events from your documents.`,
        });
        
        // Redirect to events page
        router.push('/events');
      } else {
        // Show message when no events were found
        const errorMessages = data.errors?.map(err => `${err.file}: ${err.error}`).join('\n') || '';
        setErrorDetails(errorMessages);
        
        toast({
          title: 'No events found',
          description: data.message || 'No events could be extracted from the provided files.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error extracting events:', error);
      
      toast({
        title: 'Error extracting events',
        description: error.message || 'Failed to extract events from your documents.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container max-w-4xl py-6">
      <h1 className="text-2xl font-bold mb-6">Upload Your Documents</h1>
      
      <UploadZone 
        files={files}
        onAddFiles={handleAddFiles}
        onRemoveFile={handleRemoveFile}
        onClearAll={handleClearFiles}
      />
      
      <div className="mt-8 flex justify-center">
        <Button 
          onClick={handleExtractEvents} 
          disabled={isLoading || files.length === 0}
          size="lg"
          className="w-full max-w-xs"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Extracting...
            </>
          ) : (
            'Extract Events'
          )}
        </Button>
      </div>
      
      {errorDetails && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-lg font-semibold text-red-700 mb-2">Error Details:</h3>
          <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-60 bg-red-100 p-3 rounded">
            {errorDetails}
          </pre>
          <p className="mt-4 text-sm text-red-700">
            To fix this issue, please make sure:
            <ul className="list-disc ml-5 mt-2">
              <li>Your internet connection is stable</li>
              <li>Your PDF or image files are not corrupted</li>
              <li>The files contain visible text with calendar events</li>
            </ul>
          </p>
        </div>
      )}
    </div>
  );
} 