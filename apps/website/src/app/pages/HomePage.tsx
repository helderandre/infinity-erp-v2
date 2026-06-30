"use client";

import { Hero } from '../components/Hero';
import { AboutSection } from '../components/AboutSection';
import { useEffect } from 'react';

export function HomePage() {
  useEffect(() => {
    // Load Elfsight script if not already loaded
    if (!document.querySelector('script[src="https://elfsightcdn.com/platform.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://elfsightcdn.com/platform.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <>
      <Hero />
      <AboutSection />
      
      {/* Elfsight Instagram Feed | Untitled Instagram Feed */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="elfsight-app-73c50b32-5451-4807-9b0c-5d97442e2572" data-elfsight-app-lazy></div>
        </div>
      </section>
    </>
  );
}