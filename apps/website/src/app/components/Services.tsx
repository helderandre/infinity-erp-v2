"use client";

import { ArrowUpRight, Home, Key, TrendingUp } from 'lucide-react';

export function Services() {
  const services = [
    {
      title: 'Buy Property',
      description: 'Find your dream home from our extensive collection of premium properties.',
      image: 'https://images.unsplash.com/photo-1694702740570-0a31ee1525c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBidWlsZGluZ3xlbnwxfHx8fDE3NjY3MjUyMDh8MA&ixlib=rb-4.1.0&q=80&w=1080',
      icon: Home,
    },
    {
      title: 'Expert Agents',
      description: 'Work with experienced professionals who understand your needs.',
      image: 'https://images.unsplash.com/photo-1763479169474-728a7de108c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjByZWFsJTIwZXN0YXRlJTIwYWdlbnR8ZW58MXx8fHwxNzY2NzQwNTU2fDA&ixlib=rb-4.1.0&q=80&w=1080',
      icon: Key,
    },
    {
      title: 'Property Investment',
      description: 'Invest in properties with high returns and great potential.',
      image: 'https://images.unsplash.com/photo-1606723325559-ad1bffa19bde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBwZW50aG91c2V8ZW58MXx8fHwxNzY2NzU0ODc2fDA&ixlib=rb-4.1.0&q=80&w=1080',
      icon: TrendingUp,
    },
  ];

  return (
    <section id="services" className="py-12 md:py-16 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl lg:text-5xl text-center mb-12 md:mb-16">
          What we do
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div
                key={index}
                className="group relative rounded-2xl overflow-hidden aspect-[4/5] cursor-pointer"
              >
                {/* Background Image */}
                <img
                  src={service.image}
                  alt={service.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

                {/* Content */}
                <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between">
                  {/* Icon */}
                  <div className="flex justify-end">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                      <Icon size={24} />
                    </div>
                  </div>

                  {/* Text */}
                  <div className="text-white">
                    <h3 className="text-xl md:text-2xl mb-2">{service.title}</h3>
                    <p className="text-white/80 text-sm md:text-base">
                      {service.description}
                    </p>
                  </div>
                </div>

                {/* Hover Arrow */}
                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight className="text-white" size={24} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}