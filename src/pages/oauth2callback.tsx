import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function OAuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from the query parameters
        const { code, state, error } = router.query;
        
        // Check if there was an error
        if (error) {
          console.error('OAuth error:', error);
          setStatus(`Authentication error: ${error}`);
          setTimeout(() => router.push(`/?auth_error=${error}`), 2000);
          return;
        }
        
        // Check if the code is present
        if (!code) {
          console.error('No authorization code received');
          setStatus('No authorization code received');
          setTimeout(() => router.push('/?auth_error=no_code'), 2000);
          return;
        }
        
        console.log('Received OAuth code with state:', state);
        
        // Exchange the code for tokens
        const response = await fetch('/api/auth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            state: state || 'calendar',
            redirectUri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Token exchange error:', errorData);
          setStatus(`Token exchange error: ${errorData.error || 'Unknown error'}`);
          setTimeout(() => router.push('/?auth_error=token_exchange'), 2000);
          return;
        }
        
        const data = await response.json();
        console.log('Token exchange successful, received data:', { 
          success: data.success, 
          has_refresh_token: data.has_refresh_token,
          redirect_url: data.redirect_url
        });
        
        // Authentication successful, redirect to the appropriate page
        setStatus('Authentication successful! Redirecting...');
        
        // Use the redirect URL from the response, or fall back to defaults
        if (data.redirect_url) {
          setTimeout(() => router.push(data.redirect_url), 1000);
        } else if (state === 'test') {
          setTimeout(() => router.push('/test-google-auth?calendar_access=granted'), 1000);
        } else if (state === 'calendar') {
          setTimeout(() => router.push('/?calendar_access=granted'), 1000);
        } else {
          setTimeout(() => router.push('/?auth_success=true'), 1000);
        }
      } catch (error) {
        console.error('Error handling OAuth callback:', error);
        setStatus('An error occurred during authentication');
        setTimeout(() => router.push('/?auth_error=server_error'), 2000);
      }
    };

    if (router.isReady) {
      handleCallback();
    }
  }, [router.isReady, router.query, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Authentication</h2>
          <p className="mt-2 text-sm text-gray-600">{status}</p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    </div>
  );
} 