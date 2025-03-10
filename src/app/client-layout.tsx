'use client';

import { UserProvider } from '@/lib/UserContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useEffect } from 'react';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
            {children}
          </div>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
} 