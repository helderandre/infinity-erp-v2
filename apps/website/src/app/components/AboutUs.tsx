"use client";

import { useState, useEffect, useRef } from 'react';
import { Building2, Users, Target, TrendingUp, Download, Award, Shield, Heart, Star } from 'lucide-react';
const teamImage = '/assets/e6d8acf1d08f976659c5c79941614d42d0359a93.png';
import Link from 'next/link';
import { ImageWithFallback } from './figma/ImageWithFallback';

export function AboutUs() {
  const [activeCard, setActiveCard] = useState(0);
  const [activeValueCard, setActiveValueCard] = useState(0);
  const [activeStatCard, setActiveStatCard] = useState(0);
  const visionScrollRef = useRef<HTMLDivElement>(null);
  const valuesScrollRef = useRef<HTMLDivElement>(null);

  // Auto-play for stats carousel (mobile only)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStatCard((prev) => (prev + 1) % 3);
    }, 2000); // Change every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const handleVisionScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const width = container.offsetWidth;
    const newCard = Math.round(scrollLeft / width);
    setActiveCard(newCard);
  };

  const scrollToVision = (index: number) => {
    if (visionScrollRef.current) {
      const width = visionScrollRef.current.offsetWidth;
      visionScrollRef.current.scrollTo({
        left: width * index,
        behavior: 'smooth'
      });
    }
    setActiveCard(index);
  };

  const handleValuesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const width = container.offsetWidth;
    const newCard = Math.round(scrollLeft / width);
    setActiveValueCard(newCard);
  };

  const scrollToValue = (index: number) => {
    if (valuesScrollRef.current) {
      const width = valuesScrollRef.current.offsetWidth;
      valuesScrollRef.current.scrollTo({
        left: width * index,
        behavior: 'smooth'
      });
    }
    setActiveValueCard(index);
  };

  const visionCards = [
    {
      icon: Target,
      title: 'Missão',
      description: 'Transformar o processo imobiliário através de especialização técnica profunda, transparência absoluta e tecnologia proprietária, garantindo decisões seguras, processos eficientes e resultados consistentes para cada cliente.',
      bg: 'bg-black',
      textColor: 'text-white',
      iconBg: 'bg-white',
      iconColor: 'text-black'
    },
    {
      icon: TrendingUp,
      title: 'Visão',
      description: 'Ser a referência nacional no imobiliário de excelência, reconhecida por uma metodologia própria, padrões elevados de qualidade e uma atuação seletiva, orientada para clientes que valorizam rigor, estratégia e acompanhamento personalizado.',
      bg: 'bg-gray-100',
      textColor: 'text-black',
      iconBg: 'bg-black',
      iconColor: 'text-white'
    },
    {
      icon: Building2,
      title: 'Abordagem',
      description: 'Atuamos com especialização real por área, marketing premium e processos internos testados. Sustentamos cada decisão numa análise de dados rigorosa, comunicação clara e acompanhamento total ao longo de toda a jornada imobiliária.',
      bg: 'bg-gradient-to-br from-gray-900 via-gray-800 to-black',
      textColor: 'text-white',
      iconBg: 'bg-white',
      iconColor: 'text-black'
    }
  ];

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative h-[calc(55vh+28px)] md:h-[calc(65vh+28px)] overflow-hidden -mt-[calc(4rem+0.5rem)] md:-mt-[calc(5rem+0.5rem)]">
        <div className="absolute inset-0">
          <img
            src="https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/139A4289-2.webp"
            alt="Infinity Group Team"
            className="w-full h-full object-cover object-[50%_27%] md:object-[50%_23%]"
          />
          <div className="absolute inset-0 bg-black/45"></div>
        </div>
        <div className="relative h-full flex items-center">
          <div className="max-w-7xl mx-auto px-4 md:px-6 w-full">
            <div className="max-w-3xl text-white">
              <h1 className="text-3xl md:text-5xl mb-4">Quem Somos</h1>
              <p className="text-base md:text-xl text-white/90 leading-relaxed">
                Uma equipa imobiliária de alta performance<br className="hidden md:block" /> focada em excelência, rigor, especialização e inovação
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 md:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          {/* Desktop Grid - 3 columns */}
          <div className="hidden sm:grid sm:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white p-6 md:p-8 rounded-2xl text-center">
              <div className="text-3xl md:text-4xl mb-2">15 Anos</div>
              <div className="text-gray-600 text-sm md:text-base">de Experiência</div>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-2xl text-center">
              <div className="text-3xl md:text-4xl mb-2">98%</div>
              <div className="text-gray-600 text-sm md:text-base">Clientes Satisfeitos</div>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-2xl text-center">
              <div className="text-3xl md:text-4xl mb-2">700+</div>
              <div className="text-gray-600 text-sm md:text-base">Transações Concluídas</div>
            </div>
          </div>

          {/* Mobile Carousel - Auto-play */}
          <div className="sm:hidden">
            <div className="relative overflow-hidden">
              <div 
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${activeStatCard * 100}%)` }}
              >
                {/* Card 1: 15 Anos */}
                <div className="w-full flex-shrink-0 px-4">
                  <div className="bg-white p-6 rounded-2xl text-center">
                    <div className="text-3xl mb-1">15 Anos</div>
                    <div className="text-gray-600 text-sm">de Experiência</div>
                  </div>
                </div>

                {/* Card 2: 98% */}
                <div className="w-full flex-shrink-0 px-4">
                  <div className="bg-white p-6 rounded-2xl text-center">
                    <div className="text-3xl mb-1">98%</div>
                    <div className="text-gray-600 text-sm">Clientes Satisfeitos</div>
                  </div>
                </div>

                {/* Card 3: 700+ */}
                <div className="w-full flex-shrink-0 px-4">
                  <div className="bg-white p-6 rounded-2xl text-center">
                    <div className="text-3xl mb-1">700+</div>
                    <div className="text-gray-600 text-sm">Transações Concluídas</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Introduction Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16 md:mb-24">
            <div className="rounded-2xl overflow-hidden h-[345px] md:h-[460px]">
              <img
                src="https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/photos_website/DSC09783.webp"
                alt="Contemporary architecture"
                className="w-full h-full object-cover object-[50%_40%]"
              />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl mb-6">A Nossa Filosofia</h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                O Infinity Group é uma equipa imobiliária de alta performance, orientada por elevados padrões de excelência, rigor, especialização e inovação.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                Acreditamos que o imobiliário é um processo simultaneamente técnico, analítico e profundamente humano. Por isso, cada decisão é sustentada por conhecimento, estratégia e uma compreensão real das necessidades de cada cliente.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                Trabalhamos com método, visão estratégica e tecnologia avançada, colocando o cliente no centro de todo o processo. Cada imóvel é gerido de forma criteriosa, combinando análise rigorosa, criatividade aplicada e acompanhamento próximo em todas as fases, garantindo decisões informadas e resultados consistentes.
              </p>
            </div>
          </div>

          {/* Mission, Vision & Approach Cards */}
          {/* Desktop Grid View */}
          <div className="hidden md:grid md:grid-cols-3 gap-8">
            {visionCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div key={index} className={`${card.bg} ${card.textColor} p-8 lg:p-10 rounded-3xl min-h-[400px] flex flex-col`}>
                  <div className={`w-16 h-16 ${card.iconBg} rounded-full flex items-center justify-center mb-6`}>
                    <Icon size={32} className={card.iconColor} />
                  </div>
                  <h3 className="text-2xl lg:text-3xl mb-6">{card.title}</h3>
                  <p className={`leading-relaxed text-lg ${card.textColor === 'text-white' ? 'text-white/90' : 'text-gray-700'}`}>
                    {card.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Mobile Carousel View */}
          <div className="md:hidden">
            <div 
              className="overflow-x-scroll snap-x snap-mandatory scroll-smooth scrollbar-hide"
              ref={visionScrollRef}
              onScroll={handleVisionScroll}
            >
              <div className="flex">
                {visionCards.map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <div key={index} className="w-full flex-shrink-0 px-2 snap-center">
                      <div className={`${card.bg} ${card.textColor} p-8 rounded-3xl min-h-[350px] flex flex-col`}>
                        <div className={`w-16 h-16 ${card.iconBg} rounded-full flex items-center justify-center mb-6`}>
                          <Icon size={32} className={card.iconColor} />
                        </div>
                        <h3 className="text-2xl mb-6">{card.title}</h3>
                        <p className={`leading-relaxed ${card.textColor === 'text-white' ? 'text-white/90' : 'text-gray-700'}`}>
                          {card.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dot Navigation */}
            <div className="flex justify-center gap-2 mt-6">
              {visionCards.map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollToVision(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    activeCard === index ? 'w-8 bg-black' : 'w-2 bg-gray-300'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl mb-4">Os Nossos Valores</h2>
            <p className="text-gray-600 text-lg max-w-3xl mx-auto">
              No Infinity Group, acreditamos que o imobiliário vai muito além de transações. É sobre escolhas com impacto, momentos decisivos e confiança construída ao longo do tempo.
            </p>
          </div>

          {/* Desktop Grid View */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Excellence */}
            <div className="bg-white p-8 rounded-3xl hover:shadow-lg transition-shadow">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <Award size={36} className="text-black" />
              </div>
              <h4 className="text-xl mb-4">Excelência</h4>
              <p className="text-gray-600 leading-relaxed">
                A excelência guia cada detalhe do nosso trabalho, com critério, exigência e rigor em todas as fases do processo.
              </p>
            </div>

            {/* Transparency */}
            <div className="bg-white p-8 rounded-3xl hover:shadow-lg transition-shadow">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <Shield size={36} className="text-black" />
              </div>
              <h4 className="text-xl mb-4">Transparência</h4>
              <p className="text-gray-600 leading-relaxed">
                A transparência é um princípio inegociável, assegurando decisões claras, informadas e seguras em cada etapa.
              </p>
            </div>

            {/* Commitment */}
            <div className="bg-white p-8 rounded-3xl hover:shadow-lg transition-shadow">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <Heart size={36} className="text-black" />
              </div>
              <h4 className="text-xl mb-4">Compromisso</h4>
              <p className="text-gray-600 leading-relaxed">
                O compromisso traduz-se num acompanhamento próximo e dedicado, respeitando a singularidade, os objetivos e as expectativas de cada cliente.
              </p>
            </div>

            {/* Specialization */}
            <div className="bg-white p-8 rounded-3xl hover:shadow-lg transition-shadow">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <Star size={36} className="text-black" />
              </div>
              <h4 className="text-xl mb-4">Especialização</h4>
              <p className="text-gray-600 leading-relaxed">
                A especialização sustenta a nossa atuação, garantindo soluções estratégicas alinhadas com os mais elevados padrões do mercado.
              </p>
            </div>
          </div>

          {/* Mobile Carousel View */}
          <div className="md:hidden">
            <div 
              className="overflow-x-scroll snap-x snap-mandatory scroll-smooth scrollbar-hide"
              ref={valuesScrollRef}
              onScroll={handleValuesScroll}
            >
              <div className="flex">
                {/* Excellence */}
                <div className="w-full flex-shrink-0 px-2 snap-center">
                  <div className="bg-white p-8 rounded-3xl min-h-[350px] flex flex-col">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                      <Award size={36} className="text-black" />
                    </div>
                    <h4 className="text-xl mb-4">Excelência</h4>
                    <p className="text-gray-600 leading-relaxed">
                      A excelência guia cada detalhe do nosso trabalho, com critério, exigência e rigor em todas as fases do processo.
                    </p>
                  </div>
                </div>

                {/* Transparency */}
                <div className="w-full flex-shrink-0 px-2 snap-center">
                  <div className="bg-white p-8 rounded-3xl min-h-[350px] flex flex-col">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                      <Shield size={36} className="text-black" />
                    </div>
                    <h4 className="text-xl mb-4">Transparência</h4>
                    <p className="text-gray-600 leading-relaxed">
                      A transparência é um princípio inegociável, assegurando decisões claras, informadas e seguras em cada etapa.
                    </p>
                  </div>
                </div>

                {/* Commitment */}
                <div className="w-full flex-shrink-0 px-2 snap-center">
                  <div className="bg-white p-8 rounded-3xl min-h-[350px] flex flex-col">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                      <Heart size={36} className="text-black" />
                    </div>
                    <h4 className="text-xl mb-4">Compromisso</h4>
                    <p className="text-gray-600 leading-relaxed">
                      O compromisso traduz-se num acompanhamento próximo e dedicado, respeitando a singularidade, os objetivos e as expectativas de cada cliente.
                    </p>
                  </div>
                </div>

                {/* Specialization */}
                <div className="w-full flex-shrink-0 px-2 snap-center">
                  <div className="bg-white p-8 rounded-3xl min-h-[350px] flex flex-col">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                      <Star size={36} className="text-black" />
                    </div>
                    <h4 className="text-xl mb-4">Especialização</h4>
                    <p className="text-gray-600 leading-relaxed">
                      A especialização sustenta a nossa atuação, garantindo soluções estratégicas alinhadas com os mais elevados padrões do mercado.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dot Navigation */}
            <div className="flex justify-center gap-2 mt-6">
              {[0, 1, 2, 3].map((index) => (
                <button
                  key={index}
                  onClick={() => scrollToValue(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    activeValueCard === index ? 'w-8 bg-black' : 'w-2 bg-gray-300'
                  }`}
                  aria-label={`Go to value ${index + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="text-center mt-12 md:mt-16">
            <p className="text-gray-600 text-lg max-w-3xl mx-auto">
              Estes valores não são apenas princípios, são a base de relações duradouras, decisões sólidas e experiências imobiliárias de excelência.
            </p>
          </div>
        </div>
      </section>

      {/* Team Image Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Left Side - Text Content */}
            <div className="space-y-6">
              <div>
                <p className="text-sm md:text-base font-medium tracking-wider text-gray-600 mb-3">
                  A NOSSA EQUIPA
                </p>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6">
                  Profissionais de Excelência
                </h2>
              </div>

              <div className="space-y-4 text-gray-700 text-base md:text-lg leading-relaxed">
                <p>
                  No Infinity Group, a excelência começa nas pessoas. Reunimos profissionais de referência, reconhecidos pelo seu rigor, discrição e elevado nível de especialização no mercado imobiliário.
                </p>

                <p>
                  Cada membro da equipa atua com sentido de responsabilidade, visão estratégica e atenção absoluta ao detalhe, assegurando um acompanhamento personalizado e decisões sustentadas em conhecimento profundo.
                </p>

                <p>
                  Mais do que uma equipa, somos um grupo coeso que partilha os mesmos valores e um compromisso inabalável com a qualidade. É esta cultura de exigência, confiança e distinção que nos permite criar relações duradouras e entregar experiências imobiliárias ao mais alto nível.
                </p>
              </div>
            </div>

            {/* Right Side - Team Image */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={teamImage}
                  alt="Infinity Group Team"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src="https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/photos_website/DJI_0034-2.webp"
            alt="Infinity Group"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50"></div>
        </div>

        {/* Content */}
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl lg:text-5xl text-white mb-6">
              Pronto para começar?
            </h2>
            <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto leading-relaxed">
              Entre em contacto connosco e descubra como podemos ajudá-lo a alcançar os seus objetivos imobiliários
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/contactos"
                className="inline-flex items-center justify-center gap-2 bg-white/30 backdrop-blur-md border border-white/50 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-full hover:bg-white/40 transition-colors text-base sm:text-lg font-medium"
              >
                Fale Connosco
              </Link>
              <Link
                href="/property"
                className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md border-2 border-white/50 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-full hover:bg-white/20 transition-colors text-base sm:text-lg font-medium"
              >
                Ver Imóveis
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}