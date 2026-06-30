"use client";

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Bed, Bath, Square, Lightbulb, Home, ArrowLeft, Layout,
  ChevronLeft, ChevronRight, User, Euro, Phone, MessageCircle, Mail, Map, FileText, Zap
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LeadContactModal } from '../components/LeadContactModal';
import { ImageCarouselModal } from '../components/ImageCarouselModal';
import { GoogleMapsEmbed } from '../components/GoogleMapsEmbed';

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

export function PropertyDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [property, setProperty] = useState<any>(null);
  const [consultant, setConsultant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLeadContactModal, setShowLeadContactModal] = useState(false);
  const [showImageCarouselModal, setShowImageCarouselModal] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [isDescriptionOverflowing, setIsDescriptionOverflowing] = useState(false);

  // Show "Ver mais" only when the (collapsed) description actually overflows its
  // height cap. Robust to long wrapped paragraphs — the old newline-count check
  // missed descriptions with few hard line breaks but lots of wrapped text.
  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    const measure = () => {
      setIsDescriptionOverflowing(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [property, isDescriptionExpanded]);

  // Fetch property data from Supabase
  useEffect(() => {
    async function fetchProperty() {
      try {
        setLoading(true);
        
        if (!supabase) {
          console.error('Supabase not configured');
          setLoading(false);
          return;
        }

        console.log('🔍 Fetching property with slug:', slug);

        const { data, error } = await supabase
          .from('dev_properties')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error) {
          console.error('❌ Error fetching property:', error);
          setProperty(null);
        } else {
          console.log('✅ Property fetched successfully:', data);
          console.log('📍 External Reference ID:', data.external_ref);
          
          // Fetch property specifications
          let specifications = {};
          try {
            const { data: specsData, error: specsError } = await supabase
              .from('dev_property_specifications')
              .select('*')
              .eq('property_id', data.id)
              .single();

            if (!specsError && specsData) {
              console.log('✅ Property specifications fetched successfully:', specsData);
              specifications = specsData;
            }
          } catch (err) {
            console.warn('⚠️ Could not fetch property specifications:', err);
          }

          // Fetch property media (images)
          let mediaImages: any[] = [];
          try {
            const { data: mediaData, error: mediaError } = await supabase
              .from('dev_property_media')
              .select('*')
              .eq('property_id', data.id);

            if (!mediaError && mediaData) {
              console.log(`✅ Fetched ${mediaData.length} property media items:`, mediaData);
              
              // Sort by order_index if exists, prioritize is_cover, then by created_at
              mediaImages = mediaData.sort((a, b) => {
                // If order_index exists, use it
                if (a.order_index != null && b.order_index != null) {
                  return a.order_index - b.order_index;
                }
                // Prioritize cover image
                if (a.is_cover && !b.is_cover) return -1;
                if (!a.is_cover && b.is_cover) return 1;
                // Otherwise by created_at if available
                if (a.created_at && b.created_at) {
                  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                }
                return 0;
              });
            }
          } catch (err) {
            console.warn('⚠️ Could not fetch property media:', err);
          }

          // Merge property data with specifications and media
          setProperty({ ...data, ...specifications, media: mediaImages });
          
          // Fetch consultant data if consultant_id exists
          if (data.consultant_id) {
            try {
              console.log('🔍 Fetching consultant with ID:', data.consultant_id);
              const { data: consultantData, error: consultantError } = await supabase
                .from('dev_users')
                .select(`
                  id,
                  commercial_name,
                  professional_email,
                  dev_consultant_profiles ( phone_commercial, profile_photo_url )
                `)
                .eq('id', data.consultant_id)
                .maybeSingle();

              if (consultantError) {
                console.warn('⚠️ Error fetching consultant:', consultantError);
              } else if (consultantData) {
                console.log('✅ Consultant fetched successfully:', consultantData);
                setConsultant(consultantData);
              } else {
                // Consultant ID exists but consultant not found in database (may have been deleted)
                console.log('ℹ️ Consultant ID exists but user not found in database:', data.consultant_id);
              }
            } catch (err) {
              console.log('ℹ️ Could not fetch consultant (non-critical):', err);
            }
          }
        }
      } catch (err) {
        console.error('❌ Error:', err);
        setProperty(null);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchProperty();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl mb-4">Propriedade não encontrada</h2>
          <button
            onClick={() => router.push('/property')}
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Voltar às Propriedades
          </button>
        </div>
      </div>
    );
  }

  // Process property data
  const isRent = property.business_type?.toLowerCase().includes('arrendamento');
  const statusLower = property.status?.toLowerCase();
  const isReservedOrRented = statusLower === 'reserved' || statusLower === 'rented';
  const price = isReservedOrRented
    ? 'Sob consulta'
    : isRent
      ? `€${(property.listing_price || property.asking_price || 0).toLocaleString('pt-PT')}/mês`
      : `€${(property.listing_price || property.asking_price || 0).toLocaleString('pt-PT')}`;

  // Use the actual title from the database
  const title = property.title || 'Imóvel Disponível';

  // Build full address - prioritize address_street
  const addressParts = [
    property.address_street, // Primary address field
    property.locality,
    property.city,
    property.municipality,
  ].filter(Boolean);
  
  const location = addressParts.length > 0 
    ? addressParts.join(', ') + ', Portugal'
    : `${property.locality || property.city || 'Lisboa'}, Portugal`;

  // Build complete address for Google Maps (including postal code)
  const fullAddressParts = [
    property.address_street,
    property.postal_code || property.zip_code || property.codigo_postal,
    property.locality,
    property.city,
    property.municipality,
  ].filter(Boolean);
  
  const fullMapAddress = fullAddressParts.length > 0 
    ? fullAddressParts.join(', ') + ', Portugal'
    : location;

  // Build simple location display: "city, zone"
  const simpleLocation = [property.city, property.zone].filter(Boolean).join(', ') || location;

  // Extract bedrooms from typology
  const extractBedroomsFromTypology = (typology?: string): string => {
    if (!typology) return (property.bedrooms || 0).toString();
    return typology.replace(/^[tT]/, '');
  };

  const bedroomsDisplay = extractBedroomsFromTypology(property.typology);

  // Get bathrooms count with comprehensive fallback chain
  const bathroomsCount = property.bathrooms_count || 
                         property.wc_count || 
                         property.bathrooms || 
                         property.bathrooms_total || 
                         property.total_wc || 
                         property.total_bathrooms || 
                         0;

  // Parse equipment into array
  const equipmentList = property.equipment 
    ? (typeof property.equipment === 'string' 
        ? property.equipment.split(',').map(item => item.trim()).filter(item => item.length > 0)
        : Array.isArray(property.equipment) 
          ? property.equipment 
          : [])
    : [];

  // Build image array from media - prioritize cover image first
  const images = property.media && property.media.length > 0
    ? (() => {
        const mediaUrls = property.media.map((m: any) => m.url);
        const coverImage = property.cover_image_url || property.main_image_url;
        
        // If there's a cover image and it exists in media, move it to the front
        if (coverImage && mediaUrls.includes(coverImage)) {
          return [coverImage, ...mediaUrls.filter((url: string) => url !== coverImage)];
        }
        // If there's a cover image but it's not in media, add it to the front
        else if (coverImage) {
          return [coverImage, ...mediaUrls];
        }
        // Otherwise return media urls as is
        return mediaUrls;
      })()
    : property.cover_image_url 
      ? [property.cover_image_url]
      : property.main_image_url 
        ? [property.main_image_url]
        : ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80'];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Check if floor plan exists (assuming it could be in media as type 'floor_plan' or in floor_plan_url field)
  const hasFloorPlan = property.floor_plan_url || property.media?.some((m: any) => m.type === 'floor_plan' || m.media_type === 'floor_plan');
  const floorPlanUrl = property.floor_plan_url || property.media?.find((m: any) => m.type === 'floor_plan' || m.media_type === 'floor_plan')?.url;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/property')}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Voltar às Propriedades</span>
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Images & Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Slideshow */}
            <div className="relative bg-white rounded-2xl overflow-hidden shadow-sm">
              <div 
                className="relative aspect-[16/10] lg:aspect-[16/9] cursor-pointer"
                onClick={() => setShowImageCarouselModal(true)}
              >
                <img
                  src={images[currentImageIndex]}
                  alt={title}
                  className={`w-full h-full object-cover ${isReservedOrRented ? 'opacity-80' : ''}`}
                />
                
                {/* Navigation Buttons */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        prevImage();
                      }}
                      className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center hover:bg-black/50 transition-all shadow-lg z-10 text-white"
                    >
                      <ChevronLeft size={20} className="md:hidden" />
                      <ChevronLeft size={24} className="hidden md:block" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        nextImage();
                      }}
                      className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center hover:bg-black/50 transition-all shadow-lg z-10 text-white"
                    >
                      <ChevronRight size={20} className="md:hidden" />
                      <ChevronRight size={24} className="hidden md:block" />
                    </button>
                  </>
                )}

                {/* Image Counter */}
                <div className="absolute bottom-3 right-3 md:bottom-4 md:right-4 bg-black/80 backdrop-blur-sm text-white px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm">
                  {currentImageIndex + 1} / {images.length}
                </div>

                {/* Type Badge - Only show if NOT reserved/rented */}
                {!isReservedOrRented && (
                  <div className="absolute top-3 right-3 md:top-4 md:right-4 bg-black/40 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full text-sm whitespace-nowrap drop-shadow-md">
                    {isRent ? 'Arrendamento' : 'Venda'}
                  </div>
                )}

                {/* Reserved/Rented Horizontal Banner - Spans full width */}
                {isReservedOrRented && (
                  <div className="absolute top-3 md:top-4 left-0 right-0 bg-black/40 backdrop-blur-md border-y border-white/20 text-white py-3 text-center">
                    <span className="text-xs md:text-sm font-medium drop-shadow-md">
                      {statusLower === 'reserved' ? 'Reservado' : 'Arrendado'}
                    </span>
                  </div>
                )}
              </div>

              {/* Thumbnail Strip */}
              {images.length > 1 && (
                <div className="flex gap-2 p-3 md:p-4 bg-gray-50 overflow-x-auto">
                  {images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        currentImageIndex === index 
                          ? 'border-black' 
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`${title} - Image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile: Property Summary - Shows on mobile AFTER image */}
            <div className="lg:hidden bg-white rounded-2xl p-4 shadow-sm">
              <h1 className="text-xl mb-2 font-medium">{title}</h1>
              <div className="flex items-center gap-2 text-gray-600 mb-2 text-sm">
                <MapPin size={16} />
                <span className="break-words">{simpleLocation}</span>
              </div>
              {property.external_ref && (
                <div className="text-xs text-gray-500 mb-4">
                  Ref: {property.external_ref}
                </div>
              )}

              {/* Price */}
              <div className="text-2xl font-semibold mb-4">{price}</div>

              {/* Key Stats - Mobile 2x2 Grid */}
              <div className="grid grid-cols-2 gap-3 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bed size={18} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Quartos</div>
                    <div className="font-medium text-sm">{bedroomsDisplay}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bath size={18} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Casas de banho</div>
                    <div className="font-medium text-sm">{bathroomsCount}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Layout size={18} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Área bruta</div>
                    <div className="font-medium text-sm">{(property.area_gross || property.area_bruta || property.gross_area || property.area || 0).toLocaleString()}m²</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Layout size={18} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Área útil</div>
                    <div className="font-medium text-sm">{(property.area_net || property.area_util || property.net_area || property.area_útil || 0).toLocaleString()}m²</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Home size={18} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Ano</div>
                    <div className="font-medium text-sm">{property.construction_year || property.year_built || property.year || property.ano_construcao || 'N/A'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap size={18} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Certificado</div>
                    {property.energy_certificate ? (
                      <div className="flex items-center gap-1.5">
                        <Lightbulb size={14} className={getEnergyCertificateColor(property.energy_certificate).icon} />
                        <span className={`font-bold text-sm ${getEnergyCertificateColor(property.energy_certificate).text}`}>
                          {property.energy_certificate}
                        </span>
                      </div>
                    ) : (
                      <div className="font-medium text-sm text-gray-400">N/A</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile: Consultant Info */}
              {consultant && (
                <div className="pt-4 space-y-3">
                  {/* Separator - removed Map Location button */}
                  
                  {/* Tenho Interesse Button - Mobile */}
                  <button 
                    onClick={() => setShowLeadContactModal(true)}
                    className="w-full bg-black text-white py-3 rounded-xl hover:bg-gray-800 transition-colors font-medium text-sm"
                  >
                    Tenho Interesse
                  </button>
                </div>
              )}
            </div>

            {/* Property Description */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 shadow-sm">
              <h2 className="text-lg md:text-2xl mb-3 md:mb-4 font-medium dark:text-white">Descrição do Imóvel</h2>
              <div className="relative">
                <p
                  ref={descriptionRef}
                  className={`text-gray-600 dark:text-gray-300 leading-relaxed text-sm md:text-base whitespace-pre-line ${
                    isDescriptionExpanded ? '' : 'line-clamp-[20]'
                  }`}
                  style={!isDescriptionExpanded ? { 
                    maxHeight: '30em', 
                    overflow: 'hidden'
                  } : {}}
                >
                  {property.description || `Este ${title.toLowerCase()} oferece uma experiência de vida excepcional com ${bedroomsDisplay} quartos espaçosos e ${property.bathrooms_count || property.bathrooms || 0} casas de banho modernas. Com ${(property.area_gross || property.area_bruta || property.gross_area || property.area || 0).toLocaleString()}m² de área cuidadosamente projetada, esta propriedade combina elegância contemporânea com funcionalidade confortável.`}
                </p>
              </div>
              {!isDescriptionExpanded && isDescriptionOverflowing && (
                <button
                  onClick={() => setIsDescriptionExpanded(true)}
                  className="mt-3 text-black dark:text-white font-medium text-sm hover:underline"
                >
                  Ver mais
                </button>
              )}
            </div>

            {/* Key Features */}
            {equipmentList.length > 0 && (
              <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm">
                <h2 className="text-lg md:text-2xl mb-3 md:mb-4 font-medium">Características Principais</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  {equipmentList.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-black rounded-full flex-shrink-0" />
                      <span className="text-gray-600 text-sm md:text-base">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map Location */}
            {property.latitude && property.longitude && (
              <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm">
                <h2 className="text-lg md:text-2xl mb-3 md:mb-4 font-medium">Localização</h2>
                {property.address_street && (
                  <p className="text-gray-600 mb-4 text-sm md:text-base">{property.address_street}</p>
                )}
                <GoogleMapsEmbed
                  latitude={property.latitude}
                  longitude={property.longitude}
                  height="400px"
                />
                <button
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`, '_blank')}
                  className="mt-4 w-full bg-gray-100 hover:bg-gray-200 p-3 md:p-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm md:text-base font-medium"
                >
                  <MapPin size={20} className="text-black" />
                  Ver no Google Maps
                </button>
              </div>
            )}
          </div>

          {/* Right Column - Summary & Contact (Desktop Only) */}
          <div className="hidden lg:block lg:col-span-1">
            {/* Property Summary */}
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-4">
              <h1 className="text-3xl mb-2">{title}</h1>
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <MapPin size={18} />
                <span>{simpleLocation}</span>
              </div>
              {property.external_ref && (
                <div className="text-sm text-gray-500 mb-6">
                  Ref: {property.external_ref}
                </div>
              )}

              {/* Price */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <div className="text-4xl">{price}</div>
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
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
                    <div className="text-sm text-gray-500">Casas de banho</div>
                    <div className="font-medium">{bathroomsCount}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Layout size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Área bruta</div>
                    <div className="font-medium">{(property.area_gross || property.area_bruta || property.gross_area || property.area || 0).toLocaleString()}m²</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Layout size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Área útil</div>
                    <div className="font-medium">{(property.area_net || property.area_util || property.net_area || property.area_útil || 0).toLocaleString()}m²</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Home size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Ano</div>
                    <div className="font-medium">{property.construction_year || property.year_built || property.year || property.ano_construcao || 'N/A'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Zap size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Certificado</div>
                    {property.energy_certificate ? (
                      <div className="flex items-center gap-1.5">
                        <Lightbulb size={16} className={getEnergyCertificateColor(property.energy_certificate).icon} />
                        <span className={`font-bold text-base ${getEnergyCertificateColor(property.energy_certificate).text}`}>
                          {property.energy_certificate}
                        </span>
                      </div>
                    ) : (
                      <div className="font-medium text-gray-400">N/A</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact CTA */}
              <div className="space-y-4">
                {/* Floor Plan - removed Map Location button */}
                {hasFloorPlan && (
                  <button
                    onClick={() => {
                      if (floorPlanUrl) {
                        window.open(floorPlanUrl, '_blank');
                      }
                    }}
                    className="w-full bg-gray-100 hover:bg-gray-200 p-4 rounded-xl transition-colors flex items-center gap-3"
                  >
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText size={22} className="text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-medium">Planta do Imóvel</div>
                      <div className="text-sm text-gray-600">Ver detalhes</div>
                    </div>
                  </button>
                )}

                {/* Separator */}
                {hasFloorPlan && <div className="border-t border-gray-200"></div>}
                
                {/* Tenho Interesse Button */}
                <button 
                  onClick={() => setShowLeadContactModal(true)}
                  className="w-full bg-black text-white py-3.5 rounded-xl hover:bg-gray-800 transition-colors font-medium text-base"
                >
                  Tenho Interesse
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lead Contact Modal */}
      <LeadContactModal
        isOpen={showLeadContactModal}
        onClose={() => setShowLeadContactModal(false)}
        propertyTitle={title}
        propertyId={property.id}
        propertySlug={property.slug || slug}
        propertyExternalRef={property.external_ref}
        consultant={(() => {
          if (!consultant) return null;
          const profileRaw = (consultant as any).dev_consultant_profiles;
          const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
          return {
            id: consultant.id,
            name: consultant.commercial_name || 'Consultor responsável',
            email: consultant.professional_email || null,
            phone: profile?.phone_commercial || null,
            photoUrl: profile?.profile_photo_url || null,
          };
        })()}
      />

      {/* Image Carousel Modal */}
      <ImageCarouselModal
        isOpen={showImageCarouselModal}
        onClose={() => setShowImageCarouselModal(false)}
        images={images}
        currentIndex={currentImageIndex}
        setCurrentIndex={setCurrentImageIndex}
      />

      {/* Mobile Bottom Action Bar */}
      {!showLeadContactModal && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50 shadow-lg">
          <div className="flex gap-2">
            {/* Tenho Interesse Button */}
            <button 
              onClick={() => setShowLeadContactModal(true)}
              className={`bg-black text-white py-3 rounded-xl hover:bg-gray-800 transition-colors font-medium text-sm ${hasFloorPlan ? 'flex-[0_0_60%]' : 'flex-[0_0_70%]'}`}
            >
              Tenho Interesse
            </button>
            
            {/* Map Pin Button */}
            <button
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank')}
              className={`bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex items-center justify-center ${hasFloorPlan ? 'flex-[0_0_20%]' : 'flex-[0_0_30%]'}`}
            >
              <MapPin size={22} className="text-black" />
            </button>
            
            {/* Floor Plan Button (conditionally rendered) */}
            {hasFloorPlan && (
              <button
                onClick={() => {
                  if (floorPlanUrl) {
                    window.open(floorPlanUrl, '_blank');
                  }
                }}
                className="flex-[0_0_20%] bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex items-center justify-center"
              >
                <FileText size={22} className="text-black" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}