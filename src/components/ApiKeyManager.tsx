'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ExternalLink, Info, Key } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface ApiKeyManagerProps {
  usageCount?: number;
  freeLimit?: number;
  hasCustomKey?: boolean;
  isRequired?: boolean;
}

export default function ApiKeyManager({ 
  usageCount = 0, 
  freeLimit = 5,
  hasCustomKey = false,
  isRequired = false
}: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  
  const remainingUses = freeLimit - usageCount;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid API key' });
      return;
    }
    
    if (!apiKey.trim().startsWith('sk-')) {
      setMessage({ type: 'error', text: 'API key must start with "sk-". Get your key from the OpenAI platform.' });
      return;
    }
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/settings/api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save API key');
      }
      
      setMessage({ type: 'success', text: 'API key saved successfully!' });
      setApiKey('');
      // Refresh the page to update the UI
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Key Management
        </CardTitle>
        <CardDescription>
          {hasCustomKey 
            ? 'You are using your own API key' 
            : `You have ${remainingUses <= 0 ? '0' : remainingUses} free extractions remaining`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasCustomKey && (
          <Alert variant={remainingUses <= 0 || isRequired ? "destructive" : remainingUses <= 2 ? "destructive" : "default"} className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>API Usage {isRequired ? "Required" : "Limit"}</AlertTitle>
            <AlertDescription>
              {isRequired
                ? 'OpenAI API limits reached. You need to provide your own API key to continue.'
                : remainingUses <= 0
                  ? 'You have reached your free usage limit of 5 extractions. Please provide your OpenAI API key to continue.'
                  : `You have only ${remainingUses} free extraction${remainingUses === 1 ? '' : 's'} remaining. Consider adding your API key.`}
            </AlertDescription>
          </Alert>
        )}

        <Alert variant="default" className="mb-4">
          <Info className="h-4 w-4" />
          <AlertTitle>How It Works</AlertTitle>
          <AlertDescription className="text-sm">
            Each user gets 5 free document extractions with our shared API key. 
            After that, you'll need to provide your own OpenAI API key to continue using the service.
            Your key is stored securely and only used for your extractions.
          </AlertDescription>
        </Alert>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="apiKey">OpenAI API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Your API key is securely stored and only used for your extractions. 
              <a 
                href="https://platform.openai.com/api-keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center ml-1"
              >
                Get an API key <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </p>
          </div>
          
          {message && (
            <Alert 
              variant={
                message.type === 'error' 
                  ? 'destructive' 
                  : message.type === 'info' 
                    ? 'default' 
                    : 'default'
              } 
              className="mt-4"
            >
              <AlertDescription>
                {message.text}
              </AlertDescription>
            </Alert>
          )}
          
          <Button 
            type="submit"
            className="mt-4 w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save API Key'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col items-start">
        <p className="text-sm text-muted-foreground">
          Your API key will be used instead of the default key for all future extractions.
          {hasCustomKey && (
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full"
              onClick={() => window.location.href = '/settings'}
            >
              Manage API Key Settings
            </Button>
          )}
        </p>
      </CardFooter>
    </Card>
  );
} 