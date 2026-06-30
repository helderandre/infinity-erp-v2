"use client";

import { MapPin, Phone, Mail, Send, ArrowUpRight } from 'lucide-react';
import { useState, useRef } from 'react';

export function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    company: '', // honeypot — must stay empty for real users
  });
  
  const [activeSlide, setActiveSlide] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    setActiveSlide(index);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!resp.ok) throw new Error(`contact failed: ${resp.status}`);
      alert('Obrigado pela sua mensagem! Entraremos em contacto em breve.');
      setFormData({ name: '', email: '', phone: '', message: '', company: '' });
    } catch (err) {
      console.error('Error submitting form:', err);
      alert('Ocorreu um erro ao enviar a mensagem. Por favor, tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const openInMaps = () => {
    window.open('https://maps.app.goo.gl/JPEsEqvik8U3YZ5h9', '_blank');
  };

  const handlePhoneCall = () => {
    window.location.href = 'tel:+351910523200';
  };

  const handleEmailClick = () => {
    window.location.href = 'mailto:assistente.filipe.pereira@remax.pt';
  };

  return (
    <section id="contact" className="py-12 md:py-16 pb-0 md:pb-16 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Layout */}
        <div className="hidden lg:block">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl mb-4">
              Entre em Contacto
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Tem alguma questão ou está pronto para encontrar a sua propriedade de sonho? A nossa equipa está aqui para o ajudar.
            </p>
          </div>

          {/* Contact Cards Row */}
          <div className="grid grid-cols-3 gap-5 mb-8">
            {/* Phone */}
            <div
              onClick={handlePhoneCall}
              className="relative bg-white/70 backdrop-blur-xl rounded-3xl p-7 cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all duration-300 border border-white/50 shadow-sm group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl" />
              <div className="relative flex flex-col h-full">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center group-hover:shadow-md transition-shadow duration-300">
                    <Phone className="text-white" size={18} />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-300">
                    <ArrowUpRight size={14} className="text-gray-400 group-hover:text-white transition-colors duration-300" />
                  </div>
                </div>
                <h3 className="text-lg font-medium mb-1 tracking-tight">Ligue-nos</h3>
                <p className="text-gray-400 text-xs font-light mb-4">Segunda a Sexta, 9h - 18h</p>
                <div className="mt-auto pt-4 border-t border-gray-100">
                  <p className="text-black text-sm font-medium tracking-wide">+351 910 523 200</p>
                </div>
              </div>
            </div>

            {/* Email */}
            <div
              onClick={handleEmailClick}
              className="relative bg-white/70 backdrop-blur-xl rounded-3xl p-7 cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all duration-300 border border-white/50 shadow-sm group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl" />
              <div className="relative flex flex-col h-full">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center group-hover:shadow-md transition-shadow duration-300">
                    <Mail className="text-white" size={18} />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-300">
                    <ArrowUpRight size={14} className="text-gray-400 group-hover:text-white transition-colors duration-300" />
                  </div>
                </div>
                <h3 className="text-lg font-medium mb-1 tracking-tight">Envie-nos Email</h3>
                <p className="text-gray-400 text-xs font-light mb-4">Respondemos em menos de 24h</p>
                <div className="mt-auto pt-4 border-t border-gray-100">
                  <p className="text-black text-sm font-medium truncate">assistente.filipe.pereira@remax.pt</p>
                </div>
              </div>
            </div>

            {/* Location */}
            <div
              onClick={openInMaps}
              className="relative bg-white/70 backdrop-blur-xl rounded-3xl p-7 cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all duration-300 border border-white/50 shadow-sm group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl" />
              <div className="relative flex flex-col h-full">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center group-hover:shadow-md transition-shadow duration-300">
                    <MapPin className="text-white" size={18} />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-300">
                    <ArrowUpRight size={14} className="text-gray-400 group-hover:text-white transition-colors duration-300" />
                  </div>
                </div>
                <h3 className="text-lg font-medium mb-1 tracking-tight">Visite-nos</h3>
                <p className="text-gray-400 text-xs font-light mb-4">Aberto para visitas presenciais</p>
                <div className="mt-auto pt-4 border-t border-gray-100">
                  <p className="text-black text-sm font-medium">Av. Ressano Garcia 37A</p>
                  <p className="text-gray-400 text-xs mt-0.5">1070-237 Lisboa</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form + Map Row */}
          <div className="grid grid-cols-5 gap-6">
            {/* Contact Form */}
            <div className="col-span-3 bg-white/70 backdrop-blur-xl rounded-3xl p-8 border border-white/50 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                  <Send className="text-white" size={16} />
                </div>
                <div>
                  <h3 className="text-lg font-medium tracking-tight">Envie-nos uma Mensagem</h3>
                  <p className="text-gray-400 text-xs">Preencha o formulário abaixo</p>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3.5 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/50 focus:outline-none focus:border-black/20 focus:ring-2 focus:ring-black/5 transition-all text-sm shadow-sm"
                      placeholder="João Silva"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3.5 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/50 focus:outline-none focus:border-black/20 focus:ring-2 focus:ring-black/5 transition-all text-sm shadow-sm"
                      placeholder="joao@exemplo.pt"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/50 focus:outline-none focus:border-black/20 focus:ring-2 focus:ring-black/5 transition-all text-sm shadow-sm"
                    placeholder="+351 91 000 0000"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">
                    Mensagem
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="w-full px-4 py-3.5 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/50 focus:outline-none focus:border-black/20 focus:ring-2 focus:ring-black/5 transition-all resize-none text-sm shadow-sm"
                    placeholder="Fale-nos sobre as suas necessidades imobiliárias..."
                  />
                </div>

                {/* Honeypot — hidden from users, bots fill it */}
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />

                <button
                  type="submit"
                  className="w-full bg-black text-white py-4 rounded-2xl hover:bg-gray-800 hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2.5 text-sm font-medium tracking-wide"
                  disabled={isSubmitting}
                >
                  Enviar Mensagem
                  <ArrowUpRight size={16} />
                </button>

                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Ao enviar este formulário, os seus dados serão tratados pela Infinity Group para responder ao seu pedido, de acordo com a{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                    Política de Privacidade
                  </a>
                  .
                </p>
              </form>
            </div>

            {/* Map */}
            <div className="col-span-2 bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 shadow-sm overflow-hidden cursor-pointer" onClick={openInMaps}>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3111.9907393825247!2d-9.151973423679856!3d38.73675077175984!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd19338f0e1e7b5d%3A0x8de8c8c0f8f8f8f8!2sAv.%20Ressano%20Garcia%2037A%2C%201070-234%20Lisboa%2C%20Portugal!5e0!3m2!1sen!2sus!4v1234567890123!5m2!1sen!2sus"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Office Location"
                className="pointer-events-none min-h-[400px]"
              />
            </div>
          </div>
        </div>

        {/* Mobile Carousel Layout */}
        <div className="lg:hidden">
          <h2 className="text-2xl mb-1 text-center">
            Entre em Contacto
          </h2>
          <p className="text-gray-400 text-sm text-center mb-5">Estamos aqui para o ajudar</p>

          {/* Carousel Container */}
          <div
            className="overflow-x-scroll snap-x snap-mandatory scroll-smooth scrollbar-hide"
            ref={scrollContainerRef}
            onScroll={handleScroll}
          >
            <div className="flex">
              {/* Card 1: Contact Info */}
              <div className="w-full flex-shrink-0 px-2 snap-center">
                <div className="bg-white/70 dark:bg-white/10 backdrop-blur-xl rounded-3xl p-5 shadow-sm border border-white/40 dark:border-white/10 min-h-[480px] flex flex-col mb-3">
                  <h3 className="text-lg font-medium mb-5">Informação de Contacto</h3>

                  <div className="space-y-3 flex-1">
                    {/* Phone Card */}
                    <div
                      onClick={handlePhoneCall}
                      className="flex items-center gap-3.5 bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-all border border-white/50 dark:border-white/10 shadow-sm"
                    >
                      <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                        <Phone className="text-white dark:text-black" size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium">Ligue-nos</h4>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">+351 910 523 200</p>
                      </div>
                    </div>

                    {/* Email Card */}
                    <div
                      onClick={handleEmailClick}
                      className="flex items-center gap-3.5 bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-all border border-white/50 dark:border-white/10 shadow-sm"
                    >
                      <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                        <Mail className="text-white dark:text-black" size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium">Email</h4>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">assistente.filipe.pereira@remax.pt</p>
                      </div>
                    </div>

                    {/* Location Card */}
                    <div
                      onClick={openInMaps}
                      className="flex items-center gap-3.5 bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-all border border-white/50 dark:border-white/10 shadow-sm"
                    >
                      <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                        <MapPin className="text-white dark:text-black" size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium">Visite-nos</h4>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Av. Ressano Garcia 37A, Lisboa</p>
                      </div>
                    </div>
                  </div>

                  {/* Map */}
                  <div className="rounded-2xl mt-5 h-44 overflow-hidden cursor-pointer border border-white/40 dark:border-white/10 shadow-sm" onClick={openInMaps}>
                    <iframe
                      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3111.9907393825247!2d-9.151973423679856!3d38.73675077175984!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd19338f0e1e7b5d%3A0x8de8c8c0f8f8f8f8!2sAv.%20Ressano%20Garcia%2037A%2C%201070-234%20Lisboa%2C%20Portugal!5e0!3m2!1sen!2sus!4v1234567890123!5m2!1sen!2sus"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Office Location Mobile"
                      className="rounded-2xl pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Contact Form */}
              <div className="w-full flex-shrink-0 px-2 snap-center">
                <div className="bg-white/70 dark:bg-white/10 backdrop-blur-xl rounded-3xl p-5 shadow-sm border border-white/40 dark:border-white/10 min-h-[480px] flex flex-col">
                  <h3 className="text-lg font-medium mb-5">Envie-nos uma Mensagem</h3>
                  <form onSubmit={handleSubmit} className="space-y-3.5 flex-1 flex flex-col">
                    <div>
                      <label htmlFor="mobile-name" className="block text-xs text-gray-500 mb-1.5">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        id="mobile-name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-white/50 dark:border-white/10 focus:outline-none focus:border-black/30 dark:focus:border-white/30 focus:ring-1 focus:ring-black/5 transition-all text-sm shadow-sm"
                        placeholder="João Silva"
                      />
                    </div>

                    <div>
                      <label htmlFor="mobile-email" className="block text-xs text-gray-500 mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        id="mobile-email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-white/50 dark:border-white/10 focus:outline-none focus:border-black/30 dark:focus:border-white/30 focus:ring-1 focus:ring-black/5 transition-all text-sm shadow-sm"
                        placeholder="joao@exemplo.pt"
                      />
                    </div>

                    <div>
                      <label htmlFor="mobile-phone" className="block text-xs text-gray-500 mb-1.5">
                        Telefone
                      </label>
                      <input
                        type="tel"
                        id="mobile-phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-white/50 dark:border-white/10 focus:outline-none focus:border-black/30 dark:focus:border-white/30 focus:ring-1 focus:ring-black/5 transition-all text-sm shadow-sm"
                        placeholder="+351 91 000 0000"
                      />
                    </div>

                    <div className="flex-1 flex flex-col">
                      <label htmlFor="mobile-message" className="block text-xs text-gray-500 mb-1.5">
                        Mensagem
                      </label>
                      <textarea
                        id="mobile-message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 focus:outline-none focus:border-black/30 focus:ring-1 focus:ring-black/5 transition-all resize-none flex-1 text-sm shadow-sm"
                        placeholder="Fale-nos sobre as suas necessidades imobiliárias..."
                      />
                    </div>

                    {/* Honeypot — hidden from users, bots fill it */}
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      className="hidden"
                    />

                    <button
                      type="submit"
                      className="w-full bg-black text-white py-3.5 rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-md"
                      disabled={isSubmitting}
                    >
                      <Send size={16} />
                      Enviar Mensagem
                    </button>

                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                      Ao enviar, os seus dados serão tratados de acordo com a{' '}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                        Política de Privacidade
                      </a>
                      .
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Carousel Dots Navigation */}
          <div className="flex items-center justify-center gap-2 mt-4 mb-4">
            {[0, 1].map((index) => (
              <button
                key={index}
                onClick={() => scrollToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              >
                <div
                  className={`transition-all duration-300 rounded-full ${
                    activeSlide === index
                      ? 'w-6 h-1.5 bg-black'
                      : 'w-1.5 h-1.5 bg-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}