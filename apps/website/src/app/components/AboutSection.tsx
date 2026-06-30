"use client";

import { Infinity } from 'lucide-react';
import Link from 'next/link';

export function AboutSection() {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Left Side - Text Content */}
          <div className="space-y-6">
            <div>
              <p className="text-sm md:text-base font-medium tracking-wider text-gray-400 mb-3">
                QUEM SOMOS
              </p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6">
                INFINITY GROUP
              </h2>
            </div>

            <div className="space-y-4 text-gray-300 text-base md:text-lg leading-relaxed">
              <p>
                Infinity Group é uma marca imobiliária orientada para pessoas, estilos de vida e decisões com significado.
              </p>

              <p>
                Mais do que intermediar imóveis, acompanhamos histórias. Cada projeto representa um momento importante na vida dos nossos clientes e é tratado com rigor, sensibilidade e visão estratégica.
              </p>

              <p>
                Acreditamos que cada imóvel possui uma identidade própria e que cada cliente tem expectativas únicas. Por isso, o nosso trabalho assenta numa compreensão profunda das necessidades, objetivos e aspirações de quem nos procura, permitindo-nos apresentar soluções verdadeiramente alinhadas com cada percurso de vida.
              </p>

              <p>
                Atuamos com um elevado padrão de exigência, profissionalismo e discrição, oferecendo um acompanhamento personalizado em todas as fases do processo imobiliário, da análise à decisão final.
              </p>

              <p>
                No Infinity Group, transformamos decisões imobiliárias em experiências seguras, consistentes e memoráveis, porque os espaços certos não se encontram por acaso, constroem-se com propósito.
              </p>
            </div>

            <div className="pt-4">
              <Link href="/about" className="inline-flex items-center justify-center bg-white/15 backdrop-blur-md text-white border border-white/30 px-8 md:px-10 py-4 md:py-5 rounded-full hover:bg-white/25 hover:border-white/50 transition-all duration-300 hover:scale-105 transform text-sm md:text-base font-light tracking-wide shadow-xl">
                SABER MAIS
              </Link>
            </div>
          </div>

          {/* Right Side - Image */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/principal.webp"
                alt="Infinity Group Team"
                className="w-full h-auto object-cover"
              />
              {/* Overlay gradient for better blend */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
            </div>

            {/* Decorative frame element */}
            <div className="absolute -bottom-4 -right-4 w-32 h-32 flex items-center justify-center bg-white/10 backdrop-blur-sm rounded-2xl -z-10">
              <Infinity size={48} className="text-white/40" />
            </div>
            <div className="absolute -top-4 -left-4 w-32 h-32 flex items-center justify-center bg-white/10 backdrop-blur-sm rounded-2xl -z-10">
              <Infinity size={48} className="text-white/40" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}