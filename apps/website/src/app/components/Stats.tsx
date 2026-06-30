"use client";

import { useState, useRef } from 'react';

export function Stats() {
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const width = container.offsetWidth;
    const newSlide = Math.round(scrollLeft / width);
    setActiveSlide(newSlide);
  };

  const scrollToSlide = (index: number) => {
    if (scrollContainerRef.current) {
      const width = scrollContainerRef.current.offsetWidth;
      scrollContainerRef.current.scrollTo({
        left: width * index,
        behavior: 'smooth'
      });
    }
  };

  const stats = [
    {
      value: '1,200+',
      label: 'Imóveis Vendidos',
      bg: 'bg-gray-100',
      images: [
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
      ]
    },
    {
      value: '€850M+',
      label: 'Volume Total de Vendas',
      bg: 'bg-gray-400',
      image: 'https://images.unsplash.com/photo-1694702740570-0a31ee1525c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBidWlsZGluZ3xlbnwxfHx8fDE3NjY3MjUyMDh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      value: '98%',
      label: 'Taxa de Satisfação de Clientes',
      bg: 'bg-black dark:bg-gray-800',
    }
  ];

  return (
    <section className="py-8 md:py-12 md:mt-4 relative z-20 pb-16 md:pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Grid View */}
        <div className="hidden md:grid grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`${stat.bg} rounded-2xl p-8 md:p-10 relative overflow-hidden`}
            >
              {/* Background Image for Properties stat */}
              {stat.image && (
                <div className="absolute inset-0 opacity-30">
                  <img
                    src={stat.image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="relative z-10">
                <div className={`text-4xl md:text-5xl mb-2 ${index === 2 ? 'text-white' : 'text-black'}`}>
                  {stat.value}
                </div>
                <div className={`${index === 2 ? 'text-white/80' : 'text-gray-600'}`}>
                  {stat.label}
                </div>

                {/* Customer avatars */}
                {stat.images && (
                  <div className="flex -space-x-2 mt-4">
                    {stat.images.map((img, imgIndex) => (
                      <div
                        key={imgIndex}
                        className="w-10 h-10 rounded-full border-2 border-white overflow-hidden"
                      >
                        <img
                          src={img}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Watermark for years of service */}
                {index === 2 && (
                  <div className="absolute -bottom-16 -right-16 text-white/50 dark:text-gray-400 text-[400px] md:text-[500px] leading-none" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: '200' }}>
                    ∞
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Carousel View */}
        <div className="md:hidden">
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="relative overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          >
            <div className="flex">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="w-full flex-shrink-0 px-2 snap-center"
                >
                  <div className={`${stat.bg} rounded-2xl p-8 relative overflow-hidden min-h-[200px]`}>
                    {/* Background Image for Properties stat */}
                    {stat.image && (
                      <div className="absolute inset-0 opacity-30">
                        <img
                          src={stat.image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="relative z-10">
                      <div className={`text-4xl mb-2 ${index === 2 ? 'text-white' : 'text-black'}`}>
                        {stat.value}
                      </div>
                      <div className={`${index === 2 ? 'text-white/80' : 'text-gray-600'}`}>
                        {stat.label}
                      </div>

                      {/* Customer avatars */}
                      {stat.images && (
                        <div className="flex -space-x-2 mt-4">
                          {stat.images.map((img, imgIndex) => (
                            <div
                              key={imgIndex}
                              className="w-10 h-10 rounded-full border-2 border-white overflow-hidden"
                            >
                              <img
                                src={img}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Watermark for years of service */}
                      {index === 2 && (
                        <div className="absolute -bottom-12 -right-12 text-white/50 dark:text-gray-400 text-[280px] leading-none" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: '200' }}>
                          ∞
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dot Navigation */}
          <div className="flex justify-center gap-2 mt-4">
            {stats.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollToSlide(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  activeSlide === index ? 'w-8 bg-black' : 'w-2 bg-gray-300'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}