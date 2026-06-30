"use client";

import { X, MapPin, Bed, Bath, Square, Phone, Mail, Calendar, ChevronLeft, ChevronRight, ArrowRight, MessageCircle, Lightbulb, Layout, Zap } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Energy Certificate Colors (Portuguese System)
const getEnergyCertificateColor = (certificate: string) => {
  const colors: Record<string, { bg: string; text: string; icon: string }> = {
    'A+': { bg: 'bg-emerald-600', text: 'text-emerald-600', icon: 'text-emerald-600' },
    'A': { bg: 'bg-green-500', text: 'text-green-500', icon: 'text-green-500' },
    'B': { bg: 'bg-lime-400', text: 'text-lime-600', icon: 'text-lime-600' },
    'B-': { bg: 'bg-gray-400', text: 'text-gray-400', icon: 'text-gray-400' },
    'C': { bg: 'bg-orange-400', text: 'text-orange-400', icon: 'text-orange-400' },
    'D': { bg: 'bg-orange-600', text: 'text-orange-600', icon: 'text-orange-600' },
    'E': { bg: 'bg-red-500', text: 'text-red-500', icon: 'text-red-500' },
    'F': { bg: 'bg-red-700', text: 'text-red-700', icon: 'text-red-700' },
  };
  
  return colors[certificate] || { bg: 'bg-gray-400', text: 'text-gray-400', icon: 'text-gray-400' };
};

interface Property {
  id: number | string; // Support both number and string (UUID) IDs
  title: string;
  location: string;
  price: string;
  priceValue: number;
  image: string;
  beds: number;
  baths: number;
  area_bruta: number; // Populated from area_gross in dev_property_specifications
  type: string;
  energyCertificate?: string;
  // New CRM fields
  typology?: string;
  propertyType?: string;
  yearBuilt?: number;
  equipment?: string;
  consultantName?: string;
  consultantId?: string;
  externalRef?: string;
  description?: string;
  state?: string; // Add state field
  slug?: string;
}

interface PropertyModalProps {
  property: Property | null;
  onClose: () => void;
  hideContactCTA?: boolean;
}

export function PropertyModal({ property, onClose, hideContactCTA }: PropertyModalProps) {
  const router = useRouter();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Store onClose in a ref so the effect doesn't re-run when it changes
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Close modal on escape key and prevent body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    if (property) {
      // Save current scroll position
      const scrollY = window.scrollY;

      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.removeEventListener('keydown', handleEscape);

        const scrollY = document.body.style.top;
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';

        const scrollYValue = parseInt(scrollY || '0', 10);
        const scrollPosition = isNaN(scrollYValue) ? 0 : Math.abs(scrollYValue);
        window.scrollTo(0, scrollPosition);
      };
    }
  }, [property]);

  if (!property) return null;

  // Extract bedrooms from typology (e.g., "T3" -> 3, "T3+1" -> "3+1")
  const extractBedroomsFromTypology = (typology?: string): string => {
    if (!typology) return (property.beds || 0).toString();
    // Remove 'T' or 't' and return the rest (e.g., "T3" -> "3", "T3+1" -> "3+1")
    return typology.replace(/^[tT]/, '');
  };

  const bedroomsDisplay = extractBedroomsFromTypology(property.typology);

  // Use CRM data with fallbacks - ensure property.id is a number
  const propertyId = typeof property.id === 'number' ? property.id : parseInt(String(property.id), 10) || 0;
  const yearBuilt = property.yearBuilt || 2018 + (propertyId % 5);
  const propertyTypeDisplay = property.propertyType || property.title.split(' ').pop() || 'Property';
  
  // Parse equipment into array for bullet points
  const equipmentList = property.equipment 
    ? (typeof property.equipment === 'string' 
        ? property.equipment.split(',').map(item => item.trim()).filter(item => item.length > 0)
        : Array.isArray(property.equipment) 
          ? property.equipment 
          : [])
    : [
        'Hardwood Floors',
        'Modern Kitchen',
        'Central Air Conditioning',
        'Walk-in Closets',
        'High Ceilings',
        'Smart Home System',
        'Private Balcony',
        'Gourmet Appliances'
      ];

  // Safely handle numeric values
  const areaBruta = property.area_bruta || 0;
  const lotSize = Math.round(areaBruta * 1.5);
  const parking = (property.beds || 0) >= 4 ? 3 : 2;
  const bathsDisplay = property.baths || 0;
  const bedsDisplay = property.beds || 0;
  
  // Ensure numeric values are valid numbers
  const areaBrutaSafe = isNaN(areaBruta) || areaBruta === null || areaBruta === undefined ? 0 : Number(areaBruta);
  const bathsDisplaySafe = isNaN(bathsDisplay) || bathsDisplay === null || bathsDisplay === undefined ? 0 : Number(bathsDisplay);
  const bedsDisplaySafe = isNaN(bedsDisplay) || bedsDisplay === null || bedsDisplay === undefined ? 0 : Number(bedsDisplay);
  const parkingSafe = isNaN(parking) || parking === null || parking === undefined ? 0 : Number(parking);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes do imóvel"
      className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile: Bottom Sheet */}
      <div className="md:hidden relative bg-white dark:bg-gray-800 rounded-t-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-x-hidden">
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

        {/* Property Image */}
        <div className="relative h-64 bg-gray-200">
          <img
            src={property.image}
            alt={property.title}
            className={`w-full h-full object-cover ${
              property.state?.toLowerCase() === 'reserved' ? 'opacity-80' : ''
            }`}
          />
          {/* Sale/Rent Tag - Only show if NOT reserved */}
          {property.state?.toLowerCase() !== 'reserved' && (
            <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full text-sm whitespace-nowrap drop-shadow-md">
              {property.type === 'sale' ? 'Venda' : 'Arrendamento'}
            </div>
          )}
          
          {/* Reserved Horizontal Banner - Spans full width */}
          {property.state?.toLowerCase() === 'reserved' && (
            <div className="absolute top-3 md:top-4 left-0 right-0 bg-black/30 backdrop-blur-md border-y border-white/20 text-white py-3 text-center">
              <span className="text-sm font-medium drop-shadow-md">Reservado</span>
            </div>
          )}
          
          {/* Ver Mais Button - Bottom Right */}
          <button
            onClick={() => {
              onClose();
              router.push(`/property/${property.slug || property.id}`);
            }}
            className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-md border border-white/20 text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-black/60 transition-all hover:scale-105 shadow-lg flex items-center gap-2 drop-shadow-lg"
          >
            Ver Mais
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col gap-2 mb-2">
              <h2 className="text-xl break-words">{property.title}</h2>
              <div className="text-xl">
                {property.state?.toLowerCase() === 'reserved' ? 'Sob consulta' : property.price}
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin size={18} className="flex-shrink-0" />
              <span className="break-words">{property.location}</span>
            </div>
            {property.externalRef && (
              <div className="text-xs text-gray-500 mt-1">
                Ref: {property.externalRef}
              </div>
            )}
          </div>

          {/* Key Features */}
          <div className="grid grid-cols-2 gap-4 mb-8 pb-8 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Bed size={20} className="text-gray-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Quartos</div>
                <div className="font-medium">{bedroomsDisplay}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Bath size={20} className="text-gray-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Casas de Banho</div>
                <div className="font-medium">{bathsDisplaySafe}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Layout size={20} className="text-gray-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Área</div>
                <div className="font-medium">{areaBrutaSafe > 0 ? areaBrutaSafe.toLocaleString() : '0'} m²</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Calendar size={20} className="text-gray-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Ano</div>
                <div className="font-medium">{yearBuilt}</div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl mb-3 font-medium dark:text-white">Descrição</h3>
            <div className="relative">
              <p 
                className={`text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line ${
                  isDescriptionExpanded ? '' : 'line-clamp-[15]'
                }`}
                style={!isDescriptionExpanded ? { 
                  maxHeight: '22.5em', 
                  overflow: 'hidden'
                } : {}}
              >
                {property.description || `Este magnífico ${property.title.toLowerCase()} oferece uma experiência de vida excecional com ${bedsDisplaySafe} quartos espaçosos e ${bathsDisplaySafe} casas de banho modernas. Com ${areaBrutaSafe > 0 ? areaBrutaSafe.toLocaleString() : '0'} metros quadrados de espaço meticulosamente desenhado.`}
              </p>
            </div>
            {!isDescriptionExpanded && property.description && property.description.split('\n').length > 15 && (
              <button
                onClick={() => setIsDescriptionExpanded(true)}
                className="mt-3 text-black dark:text-white font-medium text-sm hover:underline"
              >
                Ver mais
              </button>
            )}
          </div>

          {/* Additional Details */}
          <div className="mb-8">
            <h3 className="text-lg mb-4">Detalhes</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-gray-600">Estacionamento</span>
                <span className="font-medium">{parkingSafe} Lugares</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-gray-600">Estado</span>
                <span className="font-medium text-green-600">Disponível</span>
              </div>
              {property.energyCertificate && (
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600">Certificado Energético</span>
                  <div className="flex items-center gap-1.5">
                    <Lightbulb size={14} className={getEnergyCertificateColor(property.energyCertificate).icon} />
                    <span className={`font-bold text-sm ${getEnergyCertificateColor(property.energyCertificate).text}`}>
                      {property.energyCertificate}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Features */}
          {equipmentList.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg mb-4">Equipamentos</h3>
              <div className="grid grid-cols-1 gap-3">
                {equipmentList.slice(0, 6).map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full" />
                    <span className="text-gray-600">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact CTA - Only show if not hidden */}
          {!hideContactCTA && (
            <div className="space-y-3 pb-6">
              <button 
                onClick={() => {
                  onClose();
                  router.push(`/property/${property.slug || property.id}`);
                }}
                className="w-full bg-black text-white py-4 rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <span>Ver Detalhes Completos</span>
                <ArrowRight size={20} />
              </button>
            </div>
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

        {/* Left Side - Text Content (starts at 5% height) */}
        <div className="w-1/2 flex flex-col">
          {/* Empty space at top (5% of container) */}
          <div className="h-[5%]"></div>
          
          {/* Header - Fixed (not scrollable) */}
          <div className="px-12 pt-4 pb-6">
            <h2 className="text-4xl mb-3 font-light">{property.title}</h2>
            <div className="flex items-center gap-4 mb-3">
              <p className="text-3xl font-light">
                {property.state?.toLowerCase() === 'reserved' ? 'Sob consulta' : property.price}
              </p>
            </div>
            <div className="flex items-center gap-2 text-gray-600 text-lg">
              <MapPin size={20} />
              <span>{property.location}</span>
            </div>
            {property.externalRef && (
              <div className="text-sm text-gray-500 mt-2">
                Ref: {property.externalRef}
              </div>
            )}
          </div>
          
          {/* Content Card - Scrollable */}
          <div className="flex-1 overflow-y-auto px-12 pb-8">
            {/* Key Features */}
            <div className="mb-8 pb-8 border-b border-gray-200">
              <h3 className="text-xl mb-6 font-medium">Características Principais</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Bed size={22} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Quartos</div>
                    <div className="font-medium text-lg">{bedroomsDisplay}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Bath size={22} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Casas de Banho</div>
                    <div className="font-medium text-lg">{bathsDisplaySafe}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Layout size={22} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Área</div>
                    <div className="font-medium text-lg">{areaBrutaSafe > 0 ? areaBrutaSafe.toLocaleString() : '0'} m²</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Calendar size={22} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Ano</div>
                    <div className="font-medium text-lg">{yearBuilt}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-8 pb-8 border-b border-gray-200">
              <h3 className="text-xl mb-4 font-medium">Descrição</h3>
              <div className="relative">
                <p 
                  className={`text-gray-700 leading-relaxed whitespace-pre-line ${
                    isDescriptionExpanded ? '' : 'line-clamp-[15]'
                  }`}
                  style={!isDescriptionExpanded ? { 
                    maxHeight: '22.5em', 
                    overflow: 'hidden'
                  } : {}}
                >
                  {property.description || `Este magnífico ${property.title.toLowerCase()} oferece uma experiência de vida excecional com ${bedsDisplaySafe} quartos espaçosos e ${bathsDisplaySafe} casas de banho modernas. Com ${areaBrutaSafe > 0 ? areaBrutaSafe.toLocaleString() : '0'} metros quadrados de espaço meticulosamente desenhado, esta propriedade combina elegância contemporânea com funcionalidade confortável.`}
                </p>
              </div>
              {!isDescriptionExpanded && property.description && property.description.split('\n').length > 15 && (
                <button
                  onClick={() => setIsDescriptionExpanded(true)}
                  className="mt-3 text-black font-medium text-sm hover:underline"
                >
                  Ver mais
                </button>
              )}
            </div>

            {/* Property Details */}
            <div className="mb-8">
              <h3 className="text-xl mb-4 font-medium">Detalhes</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="text-gray-600">Estacionamento</span>
                  <span className="font-medium">{parkingSafe} Lugares</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="text-gray-600">Estado</span>
                  <span className="font-medium text-green-600">Disponível</span>
                </div>
                {property.energyCertificate && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Certificado Energético</span>
                    <div className="flex items-center gap-1.5">
                      <Lightbulb size={14} className={getEnergyCertificateColor(property.energyCertificate).icon} />
                      <span className={`font-bold text-sm ${getEnergyCertificateColor(property.energyCertificate).text}`}>
                        {property.energyCertificate}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Features */}
            {equipmentList.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl mb-4 font-medium">Equipamentos</h3>
                <div className="grid grid-cols-2 gap-3">
                  {equipmentList.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-black rounded-full" />
                      <span className="text-gray-600">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Full Height Photo with Contact Buttons */}
        <div className="w-1/2 relative bg-gray-200">
          {/* Full Height Image */}
          <img
            src={property.image}
            alt={property.title}
            className={`w-full h-full object-cover ${
              property.state?.toLowerCase() === 'reserved' ? 'opacity-80' : ''
            }`}
          />

          {/* Property Type Badge - Only show if NOT reserved */}
          {property.state?.toLowerCase() !== 'reserved' && (
            <div className="absolute top-6 left-6 bg-black/40 backdrop-blur-md border border-white/20 text-white px-4 py-2.5 rounded-full text-sm font-medium shadow-lg drop-shadow-md">
              {property.type === 'sale' ? 'Venda' : 'Arrendamento'}
            </div>
          )}

          {/* Reserved Horizontal Banner - Spans full width */}
          {property.state?.toLowerCase() === 'reserved' && (
            <div className="absolute top-1/4 left-0 right-0 bg-black/30 backdrop-blur-md border-y border-white/20 text-white py-3 text-center">
              <span className="text-sm font-medium drop-shadow-md">Reservado</span>
            </div>
          )}

          {/* Contact Buttons at Bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-24">
            <div className="space-y-3">
              {!hideContactCTA && (
                <button 
                  onClick={() => {
                    onClose();
                    router.push(`/property/${property.slug || property.id}`);
                  }}
                  className="w-full bg-white text-black py-4 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <span>Ver Detalhes Completos</span>
                  <ArrowRight size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}