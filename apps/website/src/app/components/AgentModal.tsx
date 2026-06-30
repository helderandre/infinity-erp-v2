"use client";

import { X, Mail, Phone, Instagram, MapPin, Award, TrendingUp, MessageCircle, Building } from 'lucide-react';
import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

// Import figma:asset images as fallback
const filipeImage = '/assets/8c7936a264ed5a45509e728e26f77eef2c4467a9.png';

interface Agent {
  id: string | number;
  name?: string;
  full_name?: string;
  title: string;
  sub_role?: string;
  role?: string;
  image: string;
  rating: number;
  properties: number;
  email: string;
  phone: string;
  instagram: string;
  bio?: string | null; // Add bio field
  languages?: string | null; // Add languages field
  specializations?: string | null; // Add specializations field
}

interface AgentModalProps {
  agent: Agent | null;
  onClose: () => void;
}

export function AgentModal({ agent, onClose }: AgentModalProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    if (agent) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [agent]);

  if (!agent) return null;

  // Get agent name from either name or full_name property
  const agentName = agent.name || agent.full_name || 'Agent';
  const agentId = typeof agent.id === 'string' ? parseInt(agent.id.slice(-2), 16) || 1 : agent.id;

  // Parse languages from database or use fallback
  const parseLanguages = (languagesData: string | null | undefined): string[] => {
    if (!languagesData) return ['Inglês', 'Português', 'Espanhol'].slice(0, 2 + (agentId % 2));
    
    // If already an array, return it
    if (Array.isArray(languagesData)) {
      return languagesData.length > 0 ? languagesData : ['Inglês', 'Português', 'Espanhol'].slice(0, 2 + (agentId % 2));
    }
    
    // If not a string, use fallback
    if (typeof languagesData !== 'string') {
      return ['Inglês', 'Português', 'Espanhol'].slice(0, 2 + (agentId % 2));
    }
    
    try {
      // Try parsing as JSON array
      const parsed = JSON.parse(languagesData);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // If not JSON, try splitting by comma
      const split = languagesData.split(',').map(l => l.trim()).filter(l => l);
      if (split.length > 0) return split;
    }
    
    // Fallback to generated data
    return ['Inglês', 'Português', 'Espanhol'].slice(0, 2 + (agentId % 2));
  };

  // Parse specializations from database or use fallback
  const parseSpecializations = (specializationsData: string | null | undefined): string[] => {
    if (!specializationsData) {
      return [
        'Imobiliário Residencial',
        'Imóveis de Luxo',
        'Propriedades de Investimento',
        'Imobiliário Comercial'
      ].slice(0, 2 + (agentId % 3));
    }
    
    // If already an array, return it
    if (Array.isArray(specializationsData)) {
      return specializationsData.length > 0 ? specializationsData : [
        'Imobiliário Residencial',
        'Imóveis de Luxo',
        'Propriedades de Investimento',
        'Imobiliário Comercial'
      ].slice(0, 2 + (agentId % 3));
    }
    
    // If not a string, use fallback
    if (typeof specializationsData !== 'string') {
      return [
        'Imobiliário Residencial',
        'Imóveis de Luxo',
        'Propriedades de Investimento',
        'Imobiliário Comercial'
      ].slice(0, 2 + (agentId % 3));
    }
    
    try {
      // Try parsing as JSON array
      const parsed = JSON.parse(specializationsData);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // If not JSON, try splitting by comma
      const split = specializationsData.split(',').map(s => s.trim()).filter(s => s);
      if (split.length > 0) return split;
    }
    
    // Fallback to generated data
    return [
      'Imobiliário Residencial',
      'Imóveis de Luxo',
      'Propriedades de Investimento',
      'Imobiliário Comercial'
    ].slice(0, 2 + (agentId % 3));
  };

  // Generate additional agent details
  const experience = 5 + (agentId % 10);
  const languages = parseLanguages(agent.languages);
  const specialties = parseSpecializations(agent.specializations);

  // Ensure we always have at least one specialty
  const safeSpecialties = specialties.length > 0 ? specialties : ['Imobiliário Residencial'];
  
  // Check if agent is from marketing to hide contacts
  const isMarketing = agent.role?.toLowerCase() === 'marketing' || agent.title?.toLowerCase().includes('marketing');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Perfil de ${agentName}`}
      className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Mobile: Bottom Sheet */}
      <div className="md:hidden relative bg-white rounded-t-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-x-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-gray-100 dark:bg-black rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-900 transition-colors shadow-lg"
        >
          <X size={20} className="text-gray-600 dark:text-white" />
        </button>

        {/* Drag Handle - Mobile Only */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Agent Image */}
        <div className="relative h-[17.6rem] bg-gray-200">
          {agent.image ? (
            <img
              src={agent.image}
              alt={agentName}
              onError={(e) => {
                e.currentTarget.src = filipeImage;
              }}
              className="w-full h-full object-cover"
              style={{ objectPosition: 'center 10%' }}
            />
          ) : (
            <img
              src={filipeImage}
              alt={agentName}
              className="w-full h-full object-cover"
              style={{ objectPosition: 'center 10%' }}
            />
          )}
          {agent.instagram && (
            <a
              href={agent.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram de ${agentName}`}
              className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm px-3 py-2 rounded-full flex items-center gap-2 shadow-lg hover:bg-black transition-colors"
            >
              <Instagram size={16} className="text-white" />
            </a>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl mb-3">{agentName}</h2>
            
            {/* Role & Sub Role as Text */}
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {agent.title}{agent.sub_role ? ` | ${agent.sub_role}` : ''}
            </p>
          </div>

          {/* About */}
          <div className="mb-8">
            <h3 className="text-lg mb-4">Sobre</h3>
            <div
              className="text-gray-700 leading-relaxed rich-text"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(
                agent.bio || `${agentName} é um profissional imobiliário dedicado com ${experience} anos de experiência no setor. Especializado em ${safeSpecialties[0].toLowerCase()}, ${agentName.split(' ')[0]} ajudou centenas de clientes a encontrar as suas propriedades de sonho e a tomar decisões de investimento sólidas. Conhecido pelo serviço excecional e profundo conhecimento do mercado, ${agentName.split(' ')[0]} está comprometido em entregar resultados extraordinários para cada cliente.`
              ) }}
            />
          </div>

          {/* Specialties - Hide for marketing */}
          {!isMarketing && (
            <div className="mb-8">
              <h3 className="text-lg mb-4">Especializações</h3>
              <div className="flex flex-wrap gap-2">
                {safeSpecialties.map((specialty, index) => (
                  <span 
                    key={index}
                    className="bg-gray-100 px-4 py-2 rounded-full text-sm"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Languages - Hide for marketing */}
          {!isMarketing && (
            <div className="mb-8 pb-8 border-b border-gray-200">
              <h3 className="text-lg mb-4">Idiomas</h3>
              <div className="flex flex-wrap gap-2">
                {languages.map((language, index) => (
                  <span 
                    key={index}
                    className="bg-gray-100 px-4 py-2 rounded-full text-sm"
                  >
                    {language}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contact Information - Hide for marketing */}
          {!isMarketing && (
            <>
              <div className="mb-8">
                <h3 className="text-lg mb-4">Informações de Contacto</h3>
                <div className="space-y-4">
                  <a
                    href={`mailto:${agent.email}`}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                      <Mail size={20} />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Email</div>
                      <div className="break-all">{agent.email}</div>
                    </div>
                  </a>
                  <a
                    href={`tel:${agent.phone}`}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                      <Phone size={20} />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Telefone</div>
                      <div>{agent.phone}</div>
                    </div>
                  </a>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="space-y-3 pb-6">
                <a 
                  href={`sms:${agent.phone}`}
                  className="w-full bg-black text-white py-4 rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle size={20} />
                  <span>Enviar Mensagem</span>
                </a>
                <a 
                  href={`https://wa.me/${agent.phone.replace(/\\+|\\s/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#25D366] text-white py-4 rounded-xl hover:bg-[#20BA5A] transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle size={20} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Desktop: Modern Split View */}
      <div className="hidden md:flex relative bg-white rounded-2xl w-full max-w-5xl h-[85vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-6 right-6 z-10 w-12 h-12 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-black transition-colors shadow-lg"
        >
          <X size={24} className="text-gray-600 dark:text-white" />
        </button>

        {/* Left Side - Text Content (starts at 10% height) */}
        <div className="w-1/2 flex flex-col">
          {/* Empty space at top (10% of container) */}
          <div className="h-[10%]"></div>
          
          {/* Header - Fixed (not scrollable) */}
          <div className="px-12 pt-8 pb-6">
            <h2 className="text-4xl mb-3 font-light">{agentName}</h2>
            
            {/* Role & Sub Role as Text */}
            <p className="text-gray-600 dark:text-gray-400 text-base">
              {agent.title}{agent.sub_role ? ` | ${agent.sub_role}` : ''}
            </p>
          </div>
          
          {/* Content Card - Scrollable */}
          <div className="flex-1 overflow-y-auto px-12 pb-8">
            {/* About */}
            <div className="mb-8">
              <h3 className="text-xl mb-4 font-medium">Sobre</h3>
              <div
                className="text-gray-700 leading-relaxed rich-text"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(
                  agent.bio || `${agentName} é um profissional imobiliário dedicado com ${experience} anos de experiência no setor. Especializado em ${safeSpecialties[0].toLowerCase()}, ${agentName.split(' ')[0]} ajudou centenas de clientes a encontrar as suas propriedades de sonho e a tomar decisões de investimento sólidas. Conhecido pelo serviço excecional e profundo conhecimento do mercado, ${agentName.split(' ')[0]} está comprometido em entregar resultados extraordinários para cada cliente.`
                ) }}
              />
            </div>

            {/* Specialties - Hide for marketing */}
            {!isMarketing && (
              <div className="mb-8">
                <h3 className="text-xl mb-4 font-medium">Especializações</h3>
                <div className="flex flex-wrap gap-2">
                  {safeSpecialties.map((specialty, index) => (
                    <span 
                      key={index}
                      className="bg-gray-100 px-4 py-2 rounded-full text-sm"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages - Hide for marketing */}
            {!isMarketing && (
              <div className="mb-8">
                <h3 className="text-xl mb-4 font-medium">Idiomas</h3>
                <div className="flex flex-wrap gap-2">
                  {languages.map((language, index) => (
                    <span 
                      key={index}
                      className="bg-gray-100 px-4 py-2 rounded-full text-sm"
                    >
                      {language}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Information - Hide for marketing */}
            {!isMarketing && (
              <>
                <div className="mb-8">
                  <h3 className="text-xl mb-4 font-medium">Informações de Contacto</h3>
                  <div className="space-y-3">
                    <a
                      href={`mailto:${agent.email}`}
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <Mail size={20} />
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Email</div>
                        <div className="break-all text-sm">{agent.email}</div>
                      </div>
                    </a>
                    <a
                      href={`tel:${agent.phone}`}
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <Phone size={20} />
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Telefone</div>
                        <div className="text-sm">{agent.phone}</div>
                      </div>
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Side - Full Height Photo with Contact Buttons */}
        <div className="w-1/2 relative bg-gray-200">
          {/* Full Height Image */}
          {agent.image ? (
            <img
              src={agent.image}
              alt={agentName}
              onError={(e) => {
                e.currentTarget.src = filipeImage;
              }}
              className="w-full h-full object-cover"
              style={{ objectPosition: 'center 20%' }}
            />
          ) : (
            <img
              src={filipeImage}
              alt={agentName}
              className="w-full h-full object-cover"
              style={{ objectPosition: 'center 20%' }}
            />
          )}

          {/* Instagram Badge */}
          {agent.instagram && (
            <a
              href={agent.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram de ${agentName}`}
              className="absolute top-6 left-6 bg-black/80 backdrop-blur-sm px-4 py-2.5 rounded-full flex items-center gap-2 shadow-lg hover:bg-black transition-colors"
            >
              <Instagram size={18} className="text-white" />
            </a>
          )}

          {/* Contact Buttons at Bottom - Hide for marketing */}
          {!isMarketing && (
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-24">
              <div className="space-y-3">
                <a 
                  href={`https://wa.me/${agent.phone.replace(/\\+|\\s/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-white text-black py-4 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <MessageCircle size={20} />
                  <span>WhatsApp</span>
                </a>
                <a 
                  href={`mailto:${agent.email}`}
                  className="w-full bg-white/10 backdrop-blur-sm text-white py-4 rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center gap-2 font-medium border border-white/20"
                >
                  <Mail size={20} />
                  <span>Enviar Email</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}