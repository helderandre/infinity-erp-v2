"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, ExternalLink } from 'lucide-react';

interface Video {
  id: number;
  url: string;
  title: string;
  description: string;
  link?: string;
}

export function VideoCarousel() {
  const [currentVideo, setCurrentVideo] = useState(0);
  const [isPlaying, setIsPlaying] = useState<boolean[]>([false, false, false, false]);
  const [showControls, setShowControls] = useState(true);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const videos: Video[] = [
    {
      id: 1,
      url: 'https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/video.2.mp4',
      title: 'Infinity Group',
      description: 'Os seus parceiros de confiança em Imobiliário',
      link: 'https://www.instagram.com/reel/DTlLIEeiAE3/?igsh=MXgyMWc0bnN5OHB2bA=='
    },
    {
      id: 2,
      url: 'https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/video.1.mp4',
      title: 'Apartamento de Luxo em Lisboa',
      description: 'T3 moderno com vista panorâmica para a cidade',
      link: 'https://www.instagram.com/reel/DTagYYaCqzP/?igsh=dDRjY3E0bWh6Y3Bj'
    },
    {
      id: 3,
      url: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_2mb.mp4',
      title: 'Moradia em Cascais',
      description: 'V4 com jardim e piscina privada',
    },
    {
      id: 4,
      url: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_5mb.mp4',
      title: 'Penthouse no Porto',
      description: 'Duplex com terraço e vista rio',
    },
  ];

  // Handle mouse movement - show controls and reset hide timer
  const handleMouseMove = () => {
    setShowControls(true);
    
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    
    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3000); // Hide after 3 seconds of no mouse movement
  };

  // Handle touch/click - toggle controls
  const handleTouch = () => {
    setShowControls((prev) => !prev);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, []);

  // Pause all videos when switching
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (video && index !== currentVideo) {
        video.pause();
        const newIsPlaying = [...isPlaying];
        newIsPlaying[index] = false;
        setIsPlaying(newIsPlaying);
      }
    });
  }, [currentVideo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      videoRefs.current.forEach((video) => {
        if (video) {
          video.pause();
          video.src = '';
        }
      });
    };
  }, []);

  const handlePrevious = () => {
    setCurrentVideo((prev) => (prev === 0 ? videos.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentVideo((prev) => (prev === videos.length - 1 ? 0 : prev + 1));
  };

  const togglePlay = (index: number) => {
    const videoElement = videoRefs.current[index];
    if (videoElement) {
      if (isPlaying[index]) {
        videoElement.pause();
      } else {
        videoElement.play().catch((error) => {
          console.log('Video play was prevented:', error);
        });
      }
      const newIsPlaying = [...isPlaying];
      newIsPlaying[index] = !newIsPlaying[index];
      setIsPlaying(newIsPlaying);
    }
  };

  return (
    <section 
      className="relative overflow-hidden bg-black"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
      onClick={handleTouch}
    >
      {/* Video Container - Full Width */}
      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
        {videos.map((video, index) => (
          <div
            key={video.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentVideo ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <video
              ref={(el) => (videoRefs.current[index] = el)}
              id={`video-${index}`}
              className="w-full h-full object-cover"
              src={video.url}
              loop
              playsInline
              onPlay={() => {
                const newIsPlaying = [...isPlaying];
                newIsPlaying[index] = true;
                setIsPlaying(newIsPlaying);
              }}
              onPause={() => {
                const newIsPlaying = [...isPlaying];
                newIsPlaying[index] = false;
                setIsPlaying(newIsPlaying);
              }}
            >
              O seu navegador não suporta vídeos HTML5.
            </video>

            {/* Play/Pause Overlay - Show/Hide with controls */}
            <div 
              className={`absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-all duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay(index);
                }}
                className="w-16 h-16 md:w-20 md:h-20 bg-white/90 dark:bg-black/90 hover:bg-white dark:hover:bg-black rounded-full flex items-center justify-center transition-all hover:scale-110"
                aria-label={isPlaying[index] ? 'Pausar vídeo' : 'Reproduzir vídeo'}
              >
                {isPlaying[index] ? (
                  <Pause size={32} className="text-black dark:text-white" />
                ) : (
                  <Play size={32} className="text-black dark:text-white ml-1" />
                )}
              </button>
            </div>

            {/* Video Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 md:p-8 pb-16 md:pb-20">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <h3 className="text-white text-xl md:text-2xl lg:text-3xl font-semibold mb-1">
                  {video.title}
                </h3>
                <p className="text-white/80 text-sm md:text-base lg:text-lg mb-4">
                  {video.description}
                </p>
                {video.link && (
                  <a
                    href={video.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md text-white border border-white/30 px-6 md:px-8 py-3 md:py-4 rounded-full hover:bg-white/25 hover:border-white/50 transition-all duration-300 hover:scale-105 transform text-sm md:text-base font-light tracking-wide shadow-xl"
                  >
                    Ver Vídeo
                    <ExternalLink size={18} />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Navigation Arrows - Show/Hide with controls */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrevious();
          }}
          className={`absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 bg-white/90 hover:bg-white rounded-full flex items-center justify-center transition-all hover:scale-110 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-label="Vídeo anterior"
        >
          <ChevronLeft size={24} className="text-black" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className={`absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 bg-white/90 hover:bg-white rounded-full flex items-center justify-center transition-all hover:scale-110 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-label="Próximo vídeo"
        >
          <ChevronRight size={24} className="text-black" />
        </button>

        {/* Dots Navigation - Show/Hide with controls */}
        <div className={`absolute bottom-8 right-4 md:right-8 z-20 flex gap-2 transition-all duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          {videos.map((video, index) => (
            <button
              key={video.id}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentVideo(index);
              }}
              className={`transition-all duration-300 rounded-full ${
                index === currentVideo
                  ? 'bg-white w-8 h-2'
                  : 'bg-white/40 hover:bg-white/60 w-2 h-2'
              }`}
              aria-label={`Ver vídeo ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}