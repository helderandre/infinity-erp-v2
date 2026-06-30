"use client";

import { 
  Heart, 
  Camera, 
  TrendingUp, 
  FileCheck, 
  Users, 
  Award,
  Sparkles,
  Shield,
  Download,
  ArrowRight
} from 'lucide-react';
import { useRef, useState } from 'react';

export function ServicesPage() {
  const servicesScrollRef = useRef<HTMLDivElement>(null);
  const [activeServiceCard, setActiveServiceCard] = useState(0);

  const handleServicesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const width = container.offsetWidth;
    const newCard = Math.round(scrollLeft / width);
    setActiveServiceCard(newCard);
  };

  const scrollToService = (index: number) => {
    if (servicesScrollRef.current) {
      const width = servicesScrollRef.current.offsetWidth;
      servicesScrollRef.current.scrollTo({
        left: width * index,
        behavior: 'smooth'
      });
    }
    setActiveServiceCard(index);
  };

  const services = [
    {
      icon: Heart,
      title: 'Consultoria Personalizada',
      description: 'Ouvimos, compreendemos e criamos uma estratégia à medida das suas necessidades. Cada cliente é único, cada sonho merece atenção dedicada.',
      features: [
        'Análise detalhada das suas necessidades',
        'Estratégia personalizada de procura ou venda',
        'Acompanhamento transparente em cada etapa',
        'Disponibilidade total para si'
      ]
    },
    {
      icon: Camera,
      title: 'Fotografia & Vídeo Profissional',
      description: 'Equipa dedicada de imagem e som para destacar cada detalhe do seu imóvel. Porque a primeira impressão é determinante.',
      features: [
        'Fotografia profissional de alta qualidade',
        'Vídeos imersivos e tours virtuais',
        'Drone para perspetivas únicas',
        'Edição premium de todas as imagens'
      ]
    },
    {
      icon: TrendingUp,
      title: 'Marketing Digital & Leads',
      description: 'Campanhas direcionadas e estratégias digitais que maximizam a visibilidade do seu imóvel e atraem os compradores certos.',
      features: [
        'Presença ativa nas redes sociais',
        'Campanhas publicitárias segmentadas',
        'SEO e otimização online',
        'Análise de resultados em tempo real'
      ]
    },
    {
      icon: FileCheck,
      title: 'Apoio Administrativo & Jurídico',
      description: 'Gestão completa de processos, documentação e apoio legal. Cuidamos de tudo para que possa focar-se no que realmente importa.',
      features: [
        'Registo no CRP (Caderneta Predial)',
        'Gestão de direitos de preferência',
        'Apoio de advogados especializados',
        'Contratos e documentação completa'
      ]
    },
    {
      icon: Users,
      title: 'CRM & Gestão Comercial',
      description: 'Sistema organizado e transparente para acompanhar o seu processo. Aceda a atualizações em tempo real através da nossa app de gestão.',
      features: [
        'Pipeline comercial estruturado',
        'Atualizações transparentes',
        'App de gestão para clientes',
        'Histórico completo de interações'
      ]
    },
    {
      icon: Sparkles,
      title: 'Gestão de Leads Dedicada',
      description: 'Lead manager dedicado que garante que nenhuma oportunidade se perde. Cada contacto é uma possibilidade que valorizamos.',
      features: [
        'Equipa dedicada de lead managers',
        'Resposta rápida a todos os contactos',
        'Qualificação profissional de interessados',
        'Follow-up estruturado e eficaz'
      ]
    }
  ];

  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: false,
    autoplay: false,
    swipeToSlide: true,
    touchThreshold: 10,
  };

  return (
    <div className="bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Hero Section with Glassmorphism - 90vh */}
      <section className="relative h-[90vh] overflow-hidden -mt-[calc(4rem+0.5rem)] md:-mt-[calc(5rem+0.5rem)]">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src="https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/DSC09585.jpg"
            alt="Luxury Interior"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-white dark:to-gray-900"></div>
        </div>

        {/* Content */}
        <div className="relative h-full container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="max-w-4xl text-center">
            {/* Badge with glassmorphism */}
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-4 py-2 mb-6">
              <Award className="text-white" size={20} />
              <span className="text-white text-sm font-medium">RE/MAX Collection • Luxury Segment</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl text-white mb-6">
              Constelação de Serviços
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
              Um ecossistema completo de soluções ao seu serviço.<br />
              Porque você está sempre no centro de tudo o que fazemos.
            </p>
            <p className="text-lg text-white/80 italic">
              "Apenas possibilidades infinitas"
            </p>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl mb-4">
              Os Nossos Serviços
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
              Cada serviço é desenhado para criar uma experiência sem fronteiras, onde o seu sonho encontra o espaço perfeito.
            </p>
          </div>

          {/* Desktop Grid - Hidden on mobile */}
          <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-900 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 group border border-gray-200 dark:border-gray-700"
                >
                  {/* Icon */}
                  <div className="w-14 h-14 bg-black dark:bg-white rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="text-white dark:text-black" size={28} />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-2xl mb-3 dark:text-white">{service.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    {service.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Mobile Slider - Shown only on mobile */}
          <div className="md:hidden">
            <div 
              className="overflow-x-scroll snap-x snap-mandatory scroll-smooth scrollbar-hide"
              ref={servicesScrollRef}
              onScroll={handleServicesScroll}
            >
              <div className="flex">
                {services.map((service, index) => {
                  const Icon = service.icon;
                  return (
                    <div key={index} className="w-full flex-shrink-0 px-2 snap-center">
                      <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 min-h-[280px] flex flex-col">
                        {/* Icon */}
                        <div className="w-14 h-14 bg-black dark:bg-white rounded-2xl flex items-center justify-center mb-6">
                          <Icon className="text-white dark:text-black" size={28} />
                        </div>

                        {/* Title & Description */}
                        <h3 className="text-2xl mb-3 dark:text-white">{service.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                          {service.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dot Navigation */}
            <div className="flex justify-center gap-2 mt-6">
              {services.map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollToService(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    activeServiceCard === index ? 'w-8 bg-black dark:bg-white' : 'w-2 bg-gray-300 dark:bg-gray-600'
                  }`}
                  aria-label={`Go to service ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* RE/MAX Collection Certification */}
      <section className="py-16 md:py-24 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="relative bg-gradient-to-br from-black to-gray-800 dark:from-gray-800 dark:to-black rounded-3xl overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '32px 32px'
                }}></div>
              </div>

              <div className="relative p-8 md:p-12 lg:p-16">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center">
                      <Award className="text-white" size={40} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-2xl md:text-3xl text-white mb-3">
                      Certificação RE/MAX Collection
                    </h3>
                    <p className="text-white/80 text-lg leading-relaxed mb-4">
                      Especialistas certificados no segmento de luxo. A nossa equipa é treinada e certificada para oferecer um serviço de excelência no mercado premium.
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-white text-sm">
                        <Shield className="inline mr-2" size={16} />
                        Consultores Certificados
                      </div>
                      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-white text-sm">
                        <Sparkles className="inline mr-2" size={16} />
                        Segmento de Luxo
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process Flow */}
      <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl mb-4">
              Como Trabalhamos
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
              Um processo pensado para si, onde a confiança, discrição e eficiência são garantidas.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {/* Desktop Grid - 3 columns */}
            <div className="hidden md:grid md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <div className="relative">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="text-5xl font-bold text-black/10 dark:text-white/10 mb-4">01</div>
                  <h3 className="text-xl mb-2 dark:text-white">Escutamos</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Compreendemos as suas necessidades, sonhos e objetivos para criar uma estratégia personalizada.
                  </p>
                </div>
                <div className="absolute top-1/2 -right-[12px] transform -translate-y-1/2 translate-x-1/2 z-10">
                  <ArrowRight className="text-gray-300 dark:text-gray-600" size={24} />
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="text-5xl font-bold text-black/10 dark:text-white/10 mb-4">02</div>
                  <h3 className="text-xl mb-2 dark:text-white">Executamos</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Colocamos em prática toda a nossa tecnologia, equipa e experiência ao seu serviço.
                  </p>
                </div>
                <div className="absolute top-1/2 -right-[12px] transform -translate-y-1/2 translate-x-1/2 z-10">
                  <ArrowRight className="text-gray-300 dark:text-gray-600" size={24} />
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="text-5xl font-bold text-black/10 dark:text-white/10 mb-4">03</div>
                <h3 className="text-xl mb-2 dark:text-white">Entregamos</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Realizamos o seu sonho com dedicação, transparência e um resultado que supera expectativas.
                </p>
              </div>
            </div>

            {/* Mobile Stacking Cards */}
            <div className="md:hidden space-y-6">
              {/* Step 1 */}
              <div className="sticky top-20 z-10">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                  <div className="text-5xl font-bold text-black/10 dark:text-white/10 mb-4">01</div>
                  <h3 className="text-xl mb-2 dark:text-white">Escutamos</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Compreendemos as suas necessidades, sonhos e objetivos para criar uma estratégia personalizada.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="sticky top-24 z-20">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                  <div className="text-5xl font-bold text-black/10 dark:text-white/10 mb-4">02</div>
                  <h3 className="text-xl mb-2 dark:text-white">Executamos</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Colocamos em prática toda a nossa tecnologia, equipa e experiência ao seu serviço.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="sticky top-28 z-30 mb-24">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                  <div className="text-5xl font-bold text-black/10 dark:text-white/10 mb-4">03</div>
                  <h3 className="text-xl mb-2 dark:text-white">Entregamos</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Realizamos o seu sonho com dedicação, transparência e um resultado que supera expectativas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section with Glassmorphism */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src="https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/DSC09588.jpg"
            alt="Modern Living Room"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60"></div>
        </div>

        {/* Content */}
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl lg:text-5xl text-white mb-6">
              Pronto para Começar?
            </h2>
            <p className="text-xl text-white/90 mb-8 leading-relaxed">
              Não temos limites para sonhar. Apenas possibilidades infinitas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/contactos"
                className="inline-flex items-center justify-center gap-2 bg-white/30 backdrop-blur-md border border-white/50 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-full hover:bg-white/40 transition-colors text-base sm:text-lg font-medium"
              >
                Fale Connosco
              </a>
              <a
                href="https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/Apresentac%CC%A7a%CC%83o_Filipe%20Pereira.pdf"
                download="Apresentacao_Infinity_Group.pdf"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  const link = document.createElement('a');
                  link.href = 'https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/Apresentac%CC%A7a%CC%83o_Filipe%20Pereira.pdf';
                  link.download = 'Apresentacao_Infinity_Group.pdf';
                  link.target = '_blank';
                  link.rel = 'noopener noreferrer';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md border-2 border-white/50 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-full hover:bg-white/20 transition-colors text-base sm:text-lg font-medium"
              >
                <Download size={20} />
                Download da nossa Brochura
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}