"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MapPin, Bed, Bath, Square } from 'lucide-react';
import { SimpleSearchBar } from './SimpleSearchBar';
import { InfinityLoader } from './InfinityLoader';
import { PropertyModal } from './PropertyModal';
import { useProperties } from '../../hooks/useProperties';

interface Property {
  id: number;
  title: string;
  location: string;
  price: string;
  priceValue: number;
  image: string;
  beds: number;
  baths: number;
  area_bruta: number;
  type: string;
  energyCertificate?: string;
  typology?: string;
  propertyType?: string;
  yearBuilt?: number;
  equipment?: string;
  consultantName?: string;
  consultantId?: string;
  externalRef?: string;
  description?: string;
  state?: string;
  propertyCondition?: string;
  slug?: string;
}

export function PropertyListings() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'sale' | 'rent'>('sale');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<any>({});
  const [showNoResults, setShowNoResults] = useState(false);

  // Single source of truth — one fetch, passed down to children
  const { properties: dbProperties, loading: dbLoading } = useProperties();

  // Get search filters from URL
  const urlLocation = searchParams.get('location');
  const urlType = searchParams.get('type');
  const urlTypology = searchParams.get('typology');
  const urlPrice = searchParams.get('price');
  const urlTransaction = searchParams.get('transaction');

  // Update filter based on URL transaction type (defaults to sale when absent)
  useEffect(() => {
    if (urlTransaction === 'rent') {
      setFilter('rent');
    } else {
      setFilter('sale');
    }
  }, [urlTransaction]);

  // Show loading animation when search params change
  useEffect(() => {
    setIsLoading(true);
    setShowNoResults(false);
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, [urlLocation, urlType, urlTypology, urlPrice, urlTransaction]);

  // Stable callback for search bar
  const handleSearch = useCallback((filters: {
    location: string;
    propertyType: string;
    typology: string;
    priceRange: string;
    transactionType: 'buy' | 'rent';
  }) => {
    const params = new URLSearchParams();
    if (filters.location && filters.location !== 'Localização') {
      params.set('location', filters.location);
    }
    if (filters.propertyType && filters.propertyType !== 'Tipo') {
      params.set('type', filters.propertyType);
    }
    if (filters.typology && filters.typology !== 'Tipologia') {
      params.set('typology', filters.typology);
    }
    if (filters.priceRange && filters.priceRange !== 'all') {
      params.set('price', filters.priceRange);
    }
    params.set('transaction', filters.transactionType);
    router.push(`/property?${params.toString()}`);
  }, [router]);

  // Stable callback for advanced filters
  const handleAdvancedFilterChange = useCallback((filters: any) => {
    setAdvancedFilters(filters);
  }, []);

  // Convert database properties to Property format
  const properties: Property[] = dbProperties
    .filter(p => p.show_on_website === true)
    .filter(p => p.external_ref)
    .filter(p => ['active', 'reserved', 'sold', 'rented'].includes(p.status?.toLowerCase()))
    .map((dbProp) => {
      const displayTitle = dbProp.title || 'Imóvel Disponível';
      const isRent = dbProp.business_type?.toLowerCase().includes('arrendamento');

      return {
        id: dbProp.id,
        title: displayTitle,
        location: `${dbProp.locality || dbProp.city || 'Lisboa'}, Portugal`,
        price: isRent
          ? `\u20ac${(dbProp.listing_price || dbProp.asking_price || 0).toLocaleString('pt-PT')}/mês`
          : `\u20ac${(dbProp.listing_price || dbProp.asking_price || 0).toLocaleString('pt-PT')}`,
        priceValue: dbProp.listing_price || dbProp.asking_price || 0,
        image: (dbProp.media && dbProp.media.length > 0)
          ? (dbProp.media.find((m: any) => m.is_cover)?.url || dbProp.media[0].url)
          : (dbProp.main_image_url || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80'),
        beds: dbProp.bedrooms || 0,
        baths: dbProp.bathrooms_count || dbProp.wc_count || dbProp.bathrooms || dbProp.bathrooms_total || dbProp.total_wc || dbProp.total_bathrooms || 0,
        area_bruta: dbProp.area_gross || dbProp.area_bruta || dbProp.gross_area || dbProp.area || 0,
        type: isRent ? 'rent' : 'sale',
        energyCertificate: dbProp.energy_certificate,
        typology: dbProp.typology,
        propertyType: dbProp.property_type,
        yearBuilt: dbProp.construction_year,
        equipment: dbProp.equipment,
        consultantName: dbProp.consultant_name,
        consultantId: dbProp.consultant_id,
        externalRef: dbProp.external_ref,
        description: dbProp.description,
        state: dbProp.status,
        propertyCondition: dbProp.property_condition || dbProp.building_condition,
        slug: dbProp.slug,
      };
    });

  // Normalize for accent/case-insensitive comparison
  const normalize = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Filter properties based on search params and advanced filter state
  const filteredProperties = properties.filter((property) => {
    // Transaction type
    if (filter !== 'all' && property.type !== filter) return false;

    // Location (supports multiple comma-separated, accent-insensitive)
    if (urlLocation && urlLocation !== 'All Locations') {
      const locations = urlLocation.split(',').map(l => normalize(l));
      if (!locations.some(loc => normalize(property.location).includes(loc))) return false;
    }

    // Property type (accent/case-insensitive)
    if (urlType && urlType !== 'All Types' && urlType !== 'Tipo') {
      if (!normalize(property.propertyType || '').includes(normalize(urlType))) return false;
    }

    // Typology (supports comma-separated multi-select, accent/case-insensitive)
    if (urlTypology && urlTypology !== 'All Typologies' && urlTypology !== 'Tipologia') {
      const selectedTypologies = urlTypology.split(',').map(t => normalize(t.trim()));
      const propTypology = normalize(property.typology || '');
      if (!selectedTypologies.some(t => propTypology.includes(t))) return false;
    }

    // Price range
    if (urlPrice && urlPrice !== 'all') {
      const [min, max] = urlPrice.split('-').map(Number);
      if (property.priceValue < min || property.priceValue > max) return false;
    }

    // ── Advanced filters ──

    // Size
    if (advancedFilters.sizeMin && property.area_bruta < advancedFilters.sizeMin) return false;
    if (advancedFilters.sizeMax && property.area_bruta > advancedFilters.sizeMax) return false;

    // Condition (property_condition / building_condition)
    if (advancedFilters.condition && advancedFilters.condition.length > 0) {
      const propCondition = (property.propertyCondition || '').toLowerCase();
      const hasMatch = advancedFilters.condition.some((cond: string) =>
        propCondition.includes(cond.toLowerCase())
      );
      if (!hasMatch) return false;
    }

    // Extras / Equipment
    if (advancedFilters.extras && advancedFilters.extras.length > 0) {
      const equipment = property.equipment || '';
      const equipmentArray = typeof equipment === 'string'
        ? equipment.split(/[,;|\n]/).map((e: string) => e.trim().toLowerCase())
        : Array.isArray(equipment) ? equipment.map((e: string) => e.toLowerCase()) : [];
      const hasMatch = advancedFilters.extras.some((extra: string) =>
        equipmentArray.some((e: string) => e.includes(extra.toLowerCase()))
      );
      if (!hasMatch) return false;
    }

    // Reference ID
    if (advancedFilters.referenceId) {
      const searchValue = advancedFilters.referenceId.trim();
      const propertyRef = (property.externalRef || '').toString();
      if (!propertyRef.includes(searchValue)) return false;
    }

    return true;
  });

  // Sort by reference number descending (latest first)
  const sortedProperties = [...filteredProperties].sort((a, b) => {
    const getRefNumber = (ref: string | undefined): number => {
      if (!ref) return 0;
      const match = ref.match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };
    return getRefNumber(b.externalRef) - getRefNumber(a.externalRef);
  });

  // Handle "no results" with delay
  useEffect(() => {
    if (dbLoading || isLoading || sortedProperties.length > 0) {
      setShowNoResults(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!dbLoading && !isLoading && sortedProperties.length === 0) {
        setShowNoResults(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [dbLoading, isLoading, sortedProperties.length]);

  const handleViewDetails = (property: Property) => {
    setSelectedProperty(property);
  };

  return (
    <section id="property" className="py-12 md:py-16 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl mb-4">Propriedades</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">Explore os nossos imóveis disponíveis</p>
        </div>

        {/* Search Bar — receives properties + result count */}
        <div className="mb-12 flex justify-center">
          <SimpleSearchBar
            properties={dbProperties}
            resultCount={!dbLoading && !isLoading ? sortedProperties.length : undefined}
            onSearch={handleSearch}
            onAdvancedFilterChange={handleAdvancedFilterChange}
            showMapButton
            onMapClick={() => {
              const params = searchParams.toString();
              router.push(`/property/map${params ? `?${params}` : ''}`);
            }}
          />
        </div>

        {/* Property Grid */}
        {isLoading || dbLoading ? (
          <InfinityLoader />
        ) : sortedProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {sortedProperties.map((property) => (
              <div
                key={property.id}
                onClick={() => setSelectedProperty(property)}
                className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow group cursor-pointer"
              >
                {/* Image */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={property.image}
                    alt={property.title}
                    className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${
                      ['reserved', 'rented'].includes(property.state?.toLowerCase() || '') ? 'opacity-80' : ''
                    }`}
                  />
                  {/* Sale/Rent Tag — only if NOT reserved/rented */}
                  {!['reserved', 'rented'].includes(property.state?.toLowerCase() || '') && (
                    <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium border border-white/20 drop-shadow-lg">
                      {property.type === 'sale' ? 'Venda' : 'Arrendamento'}
                    </div>
                  )}

                  {/* Reserved/Rented Banner */}
                  {['reserved', 'rented'].includes(property.state?.toLowerCase() || '') && (
                    <div className="absolute top-3 md:top-4 left-0 right-0 bg-black/40 backdrop-blur-md border-y border-white/20 text-white py-3 text-center">
                      <span className="text-sm font-medium drop-shadow-md">
                        {property.state?.toLowerCase() === 'reserved' ? 'Reservado' : 'Arrendado'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="text-xl mb-2">{property.title}</h3>
                    <div className="flex items-center gap-1 text-gray-600 text-sm">
                      <MapPin size={16} />
                      <span>{property.location}</span>
                    </div>
                    {property.externalRef && (
                      <div className="text-xs text-gray-500 mt-1">Ref: {property.externalRef}</div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="flex items-center gap-4 mb-4 text-gray-600 text-sm">
                    {property.typology && (
                      <div className="flex items-center gap-1">
                        <Bed size={16} />
                        <span>{property.typology.replace('T', '')}</span>
                      </div>
                    )}
                    {property.baths > 0 && (
                      <div className="flex items-center gap-1">
                        <Bath size={16} />
                        <span>{property.baths}</span>
                      </div>
                    )}
                    {property.area_bruta > 0 && (
                      <div className="flex items-center gap-1">
                        <Square size={16} />
                        <span>{property.area_bruta} m2</span>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="text-2xl">
                      {['reserved', 'rented'].includes(property.state?.toLowerCase() || '') ? 'Sob Consulta' : property.price}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(property);
                      }}
                      className="bg-black/40 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-full hover:bg-black/60 transition-all text-sm font-medium drop-shadow-lg"
                    >
                      Ver Detalhes &rarr;
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : showNoResults ? (
          <div className="text-center py-16">
            <p className="text-gray-600 text-lg mb-4">Nenhuma propriedade encontrada com os critérios especificados.</p>
            <button
              onClick={() => {
                setFilter('sale');
                setAdvancedFilters({});
                router.push('/property');
              }}
              className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <InfinityLoader />
        )}
      </div>

      {/* Property Modal */}
      {selectedProperty && (
        <PropertyModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </section>
  );
}
