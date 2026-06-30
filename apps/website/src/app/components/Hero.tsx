"use client";

import { useRouter } from 'next/navigation';
import { Users, Home } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Hero() {
  const router = useRouter();
  const [isApple, setIsApple] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    // Detect if device is Apple (Mac, iPhone, iPad)
    const userAgent = window.navigator.userAgent;
    const isAppleDevice = /Mac|iPhone|iPad|iPod/.test(userAgent);
    setIsApple(isAppleDevice);
  }, []);

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('❌ Video failed to load:', e);
    setVideoError(true);
  };

  const handleVideoLoad = () => {
    console.log('✅ Video loaded successfully');
    setVideoError(false);
  };

  return (
    <section id="home" className="relative h-screen min-h-[600px] overflow-hidden bg-black -mt-[calc(4rem+0.5rem)] md:-mt-[calc(5rem+0.5rem)]">
      {/* Background Video */}
      <div className="absolute inset-0">
        {!videoError ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="w-full h-full object-cover"
            onError={handleVideoError}
            onLoadedData={handleVideoLoad}
          >
            <source src="https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/landing-page_video_hero.mp4" type="video/mp4" />
            O seu navegador não suporta vídeos HTML5.
          </video>
        ) : (
          // Fallback to black background if video fails
          <div className="w-full h-full bg-black" />
        )}
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Content */}
      <div 
        className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center py-12 md:py-16 lg:py-20" 
        style={{ fontFamily: isApple ? "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif" : "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}
      >
        {/* Main Content */}
        <div className="mb-8 md:mb-10">
          <div className="max-w-4xl">
            {/* Small Title */}
            <p className="text-white/90 text-[9px] md:text-[11px] uppercase tracking-[0.2em] mb-4 md:mb-6 font-light">
              INFINITY GROUP
            </p>
            
            {/* Main Heading */}
            <h1 className="text-white font-light leading-[1.1] mb-0">
              <span className={`block ${
                isApple 
                  ? 'text-[29px] md:text-[43px] lg:text-[58px] xl:text-[72px]' 
                  : 'text-[25px] md:text-[40px] lg:text-[52px] xl:text-[65px]'
              }`}>
                Os seus parceiros
              </span>
              <span className={`block ${
                isApple 
                  ? 'text-[29px] md:text-[43px] lg:text-[58px] xl:text-[72px]' 
                  : 'text-[25px] md:text-[40px] lg:text-[52px] xl:text-[65px]'
              }`}>
                de confiança em
              </span>
              <span className={`block italic font-normal ${
                isApple 
                  ? 'text-[29px] md:text-[43px] lg:text-[58px] xl:text-[72px]' 
                  : 'text-[25px] md:text-[40px] lg:text-[52px] xl:text-[65px]'
              }`}>
                Imobiliário
              </span>
            </h1>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 max-w-4xl">
          <button
            onClick={() => router.push('/property')}
            className="group flex items-center justify-center gap-3 bg-white/15 backdrop-blur-md text-white border border-white/30 px-8 md:px-10 py-4 md:py-5 rounded-full hover:bg-white/25 hover:border-white/50 transition-all duration-300 hover:scale-105 transform text-sm md:text-base font-light tracking-wide shadow-xl"
          >
            <Home size={20} className="group-hover:scale-110 transition-transform" />
            <span>Ver Imóveis</span>
          </button>
          
          <button
            onClick={() => router.push('/agents')}
            className="group flex items-center justify-center gap-3 bg-white/15 backdrop-blur-md text-white border border-white/30 px-8 md:px-10 py-4 md:py-5 rounded-full hover:bg-white/25 hover:border-white/50 transition-all duration-300 hover:scale-105 transform text-sm md:text-base font-light tracking-wide shadow-xl"
          >
            <Users size={20} className="group-hover:scale-110 transition-transform" />
            <span>A Nossa Equipa</span>
          </button>
        </div>
      </div>
    </section>
  );
}