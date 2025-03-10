'use client';

import { useTheme } from '@/lib/ThemeContext';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return <div className="theme-toggle-placeholder"></div>;
  }
  
  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      type="button"
    >
      <div className="toggle-track">
        <div className={`toggle-thumb ${theme === 'dark' ? 'dark' : 'light'}`}>
          {theme === 'dark' ? (
            <svg className="theme-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg className="theme-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 1V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 21V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.22 4.22L5.64 5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.36 18.36L19.78 19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.22 19.78L5.64 18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.36 5.64L19.78 4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <div className="toggle-icons">
          <span className="moon">🌙</span>
          <span className="sun">☀️</span>
        </div>
      </div>
      
      <style jsx>{`
        .theme-toggle {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
          outline: none;
        }
        
        .toggle-track {
          position: relative;
          width: 3rem;
          height: 1.5rem;
          background-color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'};
          border-radius: 9999px;
          transition: background-color 0.3s;
          padding: 0.125rem;
        }
        
        .toggle-thumb {
          position: absolute;
          top: 0.125rem;
          left: 0.125rem;
          width: 1.25rem;
          height: 1.25rem;
          background-color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        .toggle-thumb.dark {
          transform: translateX(1.5rem);
          background-color: #1f2937;
        }
        
        .theme-icon {
          width: 0.75rem;
          height: 0.75rem;
          color: ${theme === 'dark' ? '#818cf8' : '#f97316'};
        }
        
        .toggle-icons {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 0.375rem;
          pointer-events: none;
        }
        
        .sun, .moon {
          font-size: 0.75rem;
          line-height: 1;
          transition: opacity 0.3s;
        }
        
        .sun {
          opacity: ${theme === 'dark' ? '0.5' : '1'};
        }
        
        .moon {
          opacity: ${theme === 'dark' ? '1' : '0.5'};
        }
        
        .theme-toggle-placeholder {
          width: 3rem;
          height: 1.5rem;
          border-radius: 9999px;
          background-color: rgba(0, 0, 0, 0.1);
        }
        
        .theme-toggle:focus .toggle-track {
          box-shadow: 0 0 0 2px var(--primary);
        }
        
        .theme-toggle:hover .toggle-track {
          background-color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.15)'};
        }
      `}</style>
    </button>
  );
} 