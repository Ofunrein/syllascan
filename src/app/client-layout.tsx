'use client';

import { UserProvider } from '@/lib/UserContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import CalendarAuthBanner from '@/components/CalendarAuthBanner';
import { useEffect, useState } from 'react';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showAuthBanner, setShowAuthBanner] = useState(false);

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
          <div className="app-container">
            {showAuthBanner && <CalendarAuthBanner />}
            {children}
          </div>
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