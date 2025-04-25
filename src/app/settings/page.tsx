'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import ApiKeyManager from '@/components/ApiKeyManager';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Settings, Key, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ApiUsageData {
  usageCount: number;
  hasCustomKey: boolean;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [usageData, setUsageData] = useState<ApiUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

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

    fetchUsageData();
  }, [status]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex justify-center items-center h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="api-keys" className="flex items-center gap-1">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-1">
            <User className="h-4 w-4" />
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-6">
          <div className="grid gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">API Key Settings</h2>
              <p className="text-muted-foreground">
                Manage your OpenAI API key for document processing. By default, you can process up
                to 5 documents using our API key, after which you'll need to provide your own.
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-6">
              <ApiKeyManager 
                usageCount={usageData?.usageCount || 0}
                freeLimit={5}
                hasCustomKey={usageData?.hasCustomKey || false}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Usage Information</CardTitle>
                  <CardDescription>
                    Your current API usage statistics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Documents Processed:</span>
                      <span className="font-medium">{usageData?.usageCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Free Limit:</span>
                      <span className="font-medium">5</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Using Custom API Key:</span>
                      <span className="font-medium">{usageData?.hasCustomKey ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <div className="grid gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Account Settings</h2>
              <p className="text-muted-foreground">
                Manage your account settings and preferences.
              </p>
            </div>

            <Separator />

            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  Your current account details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="font-medium">{session?.user?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Name:</span>
                    <span className="font-medium">{session?.user?.name || 'Not set'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button variant="destructive" className="w-full">
              Sign Out
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 