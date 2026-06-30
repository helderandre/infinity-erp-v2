"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export function DarkModeProvider({ children }: { children: ReactNode }) {
  // SSR-safe: always start false on the server, then hydrate from localStorage.
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Read saved preference once on the client after mount.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('darkMode') : null;
    if (saved === 'true') setIsDarkMode(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Save preference to localStorage
    localStorage.setItem('darkMode', isDarkMode.toString());

    // Apply or remove dark mode class to document
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
}
