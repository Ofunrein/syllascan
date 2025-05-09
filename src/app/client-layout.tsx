'use client';

import { UserProvider } from '@/lib/UserContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { ToastProvider } from '@/components/ui/use-toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import CalendarAuthBanner from '@/components/CalendarAuthBanner';
import ToastDismissButton from '@/components/ToastDismissButton';
import { useEffect, useState } from 'react';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showAuthBanner, setShowAuthBanner] = useState(false);
  const [showToastButton, setShowToastButton] = useState(false);

  // Check if Google Calendar auth has expired
  useEffect(() => {
    const checkAuth = () => {
      // Check for the presence of an error notification in the DOM
      const errorNotification = document.querySelector('.bg-red-500, .text-red-500');
      const expiredText = document.body.textContent?.includes('Google Calendar authorization expired');
      
      if (errorNotification || expiredText) {
        setShowAuthBanner(true);
      }
    };

    // Check after the component mounts and DOM is fully loaded
    const timeoutId = setTimeout(checkAuth, 2000);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  // Watch for toast notifications to show the dismiss button
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const toasts = document.querySelectorAll('[role="status"]');
          if (toasts.length > 0) {
            setShowToastButton(true);
          } else {
            setShowToastButton(false);
          }
        }
      }
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    return () => observer.disconnect();
  }, []);
  
  // Remove any unwanted SVG elements on mount
  useEffect(() => {
    const svgs = document.querySelectorAll('svg:not([class])');
    svgs.forEach(svg => {
      svg.style.display = 'none';
    });
    
    // Also try to remove any large arrows or other problematic elements
    const largeElements = document.querySelectorAll('svg[width="100%"], svg[height="100%"]');
    largeElements.forEach(el => {
      el.style.display = 'none';
    });
  }, []);
  
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <UserProvider>
          <ToastProvider>
            <div className="app-container">
              {showAuthBanner && <CalendarAuthBanner />}
              {showToastButton && <ToastDismissButton />}
              {children}
            </div>
          </ToastProvider>
          <style jsx global>{`
            /* Fix for dropdown menus to ensure they appear on top */
            .user-menu {
              position: relative;
              z-index: 50;
            }
            
            /* Ensure menu items are properly displayed */
            .dashboard-link, .menu-item {
              display: flex !important;
              align-items: center !important;
              text-decoration: none !important;
            }
            
            /* Improve dashboard visibility in dark mode */
            .dark .menu-item {
              color: rgba(255, 255, 255, 0.9) !important;
            }
            
            /* Make menu text more visible in dropdown */
            a[href="/dashboard"] {
              color: inherit !important;
            }
            
            /* Ensure good contrast for dashboard text */
            .dark a[href="/dashboard"] {
              color: rgba(255, 255, 255, 0.9) !important;
            }
          `}</style>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
} 