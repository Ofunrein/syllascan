'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ApiUsageData {
  usageCount: number;
  hasCustomKey: boolean;
}

export default function ApiKeyBanner() {
  const { data: session, status } = useSession();
  const [usageData, setUsageData] = useState<ApiUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // Load API usage data
  useEffect(() => {
    const fetchUsageData = async () => {
      if (status !== 'authenticated') return;

      try {
        const response = await fetch('/api/settings/usage');
        if (response.ok) {
          const data = await response.json();
          setUsageData(data);
        }
      } catch (error) {
        console.error('Error fetching API usage data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchUsageData();
    }
  }, [status]);

  // Check if banner should be shown
  const shouldShowBanner = () => {
    if (!usageData || isLoading || isDismissed || status !== 'authenticated') {
      return false;
    }

    // Show if using custom key
    if (usageData.hasCustomKey) {
      return false;
    }

    // Show if approaching the limit
    const freeLimit = 5;
    const remainingUses = freeLimit - usageData.usageCount;

    return remainingUses <= 2;
  };

  if (!shouldShowBanner()) {
    return null;
  }

  const freeLimit = 5;
  const remainingUses = freeLimit - (usageData?.usageCount || 0);

  return (
    <Alert variant={remainingUses <= 0 ? "destructive" : "warning"} className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>
        {remainingUses <= 0 ? 'API Usage Limit Reached' : 'API Usage Limit Approaching'}
      </AlertTitle>
      <AlertDescription className="flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          {remainingUses <= 0 ? (
            'You have reached your free usage limit. Please provide your own OpenAI API key to continue using the extraction feature.'
          ) : (
            `You have only ${remainingUses} free extraction${remainingUses === 1 ? '' : 's'} remaining. Consider adding your own API key.`
          )}
        </div>
        <div className="flex space-x-2 mt-3 md:mt-0">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setIsDismissed(true)}
          >
            Dismiss
          </Button>
          <Button 
            size="sm" 
            variant="default" 
            asChild
          >
            <Link href="/settings">
              Add API Key
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
} 