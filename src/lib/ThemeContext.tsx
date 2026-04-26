'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark'); // default dark
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage, default to dark if nothing saved
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    setTheme(savedTheme === 'light' ? 'light' : 'dark');
    setMounted(true);
  }, []);

  // Update document class when theme changes
  useEffect(() => {
    if (!mounted) return;
    
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const contextValue = {
    theme: mounted ? theme : 'dark',
    toggleTheme,
    isDark: !mounted || theme === 'dark'
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 