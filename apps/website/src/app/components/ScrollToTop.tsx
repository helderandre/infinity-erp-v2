"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // Instantly jump to top without smooth scrolling animation
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // No animation, instant jump
    });
    
    // Also reset scroll position on the document (backup method)
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
}