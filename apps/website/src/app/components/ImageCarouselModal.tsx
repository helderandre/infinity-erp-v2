"use client";

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageCarouselModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  title?: string;
  currentIndex?: number;
  setCurrentIndex?: (index: number) => void;
}

export function ImageCarouselModal({ 
  isOpen, 
  onClose, 
  images, 
  initialIndex = 0,
  title,
  currentIndex: externalCurrentIndex,
  setCurrentIndex: externalSetCurrentIndex
}: ImageCarouselModalProps) {
  const [localCurrentIndex, setLocalCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setLocalCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, localCurrentIndex]);

  const nextImage = () => {
    setLocalCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setLocalCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Galeria: ${title}` : 'Galeria de imagens'}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Glassmorphism Background */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
      
      {/* Modal Content */}
      <div 
        className="relative w-full max-w-5xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8 px-2 md:px-8">
          <div className="flex items-center gap-6 flex-1">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full text-sm">
              {localCurrentIndex + 1} / {images.length}
            </div>
            {title && (
              <h2 className="text-white text-lg md:text-xl font-medium">{title}</h2>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar galeria"
            className="w-10 h-10 md:w-12 md:h-12 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Image Container */}
        <div className="relative flex-1 flex items-center justify-center max-h-[65vh]">
          {/* Main Image */}
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={images[localCurrentIndex]}
              alt={`Image ${localCurrentIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
            />

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  aria-label="Imagem anterior"
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-full flex items-center justify-center transition-all text-white"
                >
                  <ChevronLeft size={28} />
                </button>
                <button
                  onClick={nextImage}
                  aria-label="Próxima imagem"
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-full flex items-center justify-center transition-all text-white"
                >
                  <ChevronRight size={28} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Thumbnail Strip */}
        {images.length > 1 && (
          <div className="mt-8 px-2">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {images.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setLocalCurrentIndex(index)}
                  aria-label={`Ver imagem ${index + 1}`}
                  aria-current={localCurrentIndex === index}
                  className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    localCurrentIndex === index 
                      ? 'border-white scale-105' 
                      : 'border-white/30 opacity-60 hover:opacity-100 hover:border-white/60'
                  }`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}