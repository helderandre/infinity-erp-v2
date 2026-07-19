"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MapPin, Bed, Bath, Square } from 'lucide-react';
import { SimpleSearchBar, type SortOption } from './SimpleSearchBar';
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
  const [sortBy, setSortBy] = useState<SortOption>('recent');

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

  // Ordenação — por omissão referência mais recente primeiro; opcionalmente por preço
  // (imóveis sem preço vão sempre para o fim nas ordenações por preço)
  const sortedProperties = (() => {
    const arr = [...filteredProperties];
    if (sortBy === 'price_asc' || sortBy === 'price_desc') {
      return arr.sort((a, b) => {
        if (!a.priceValue && !b.priceValue) return 0;
        if (!a.priceValue) return 1;
        if (!b.priceValue) return -1;
        return sortBy === 'price_desc' ? b.priceValue - a.priceValue : a.priceValue - b.priceValue;
      });
    }
    // 'recent' — sort by reference number descending (latest first)
    const getRefNumber = (ref: string | undefined): number => {
      if (!ref) return 0;
      const match = ref.match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };
    return arr.sort((a, b) => getRefNumber(b.externalRef) - getRefNumber(a.externalRef));
  })();

  // Dois grupos, em vez de tudo misturado na mesma grelha:
  //   1. Disponíveis           → imóveis ainda no mercado
  //   2. Reservados e Vendidos → reservados / vendidos / arrendados (em baixo)
  const UNAVAILABLE_STATES = ['reserved', 'rented', 'sold'];
  const isUnavailable = (p: Property) =>
    UNAVAILABLE_STATES.includes(p.state?.toLowerCase() || '');
  const availableProperties = sortedProperties.filter((p) => !isUnavailable(p));
  const unavailableProperties = sortedProperties.filter(isUnavailable);

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

  // Etiqueta do estado — null quando o imóvel ainda está disponível.
  const stateLabel = (state?: string): string | null => {
    switch (state?.toLowerCase()) {
      case 'reserved': return 'Reservado';
      case 'rented': return 'Arrendado';
      case 'sold': return 'Vendido';
      default: return null;
    }
  };

  const renderCard = (property: Property) => {
    const badge = stateLabel(property.state);
    return (
      <div
        onClick={() => setSelectedProperty(property)}
        className="h-full bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow group cursor-pointer"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={property.image}
            alt={property.title}
            className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${
              badge ? 'opacity-80' : ''
            }`}
          />
          {/* Venda/Arrendamento — só quando ainda está disponível */}
          {!badge && (
            <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium border border-white/20 drop-shadow-lg">
              {property.type === 'sale' ? 'Venda' : 'Arrendamento'}
            </div>
          )}

          {/* Faixa Vendido / Reservado / Arrendado */}
          {badge && (
            <div className="absolute top-3 md:top-4 left-0 right-0 bg-black/40 backdrop-blur-md border-y border-white/20 text-white py-3 text-center">
              <span className="text-sm font-medium drop-shadow-md">{badge}</span>
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
            <div className="text-2xl">{badge ? 'Sob Consulta' : property.price}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewDetails(property);
              }}
              className="bg-black/40 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-full hover:bg-black/60 transition-all text-sm font-medium drop-shadow-lg whitespace-nowrap"
            >
              <span className="md:hidden">Ver</span>
              <span className="hidden md:inline">Ver Detalhes &rarr;</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Mobile: carrossel horizontal deslizável (scroll-snap).
  // Desktop (md+): grelha normal de 2/3 colunas.
  const renderRow = (items: Property[]) => (
    <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pb-4 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((property) => (
        <div
          key={property.id}
          className="shrink-0 w-[85%] sm:w-[55%] md:w-auto snap-start"
        >
          {renderCard(property)}
        </div>
      ))}
    </div>
  );

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
            sortBy={sortBy}
            onSortChange={setSortBy}
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
          <>
            {/* 1. Disponíveis */}
            {availableProperties.length > 0 && renderRow(availableProperties)}

            {/* 2. Reservados e Vendidos — inclui também os arrendados */}
            {unavailableProperties.length > 0 && (
              <div
                className={
                  availableProperties.length > 0
                    ? 'mt-14 md:mt-16 pt-10 md:pt-12 border-t border-gray-200 dark:border-gray-700'
                    : ''
                }
              >
                <div className="flex items-baseline gap-3 mb-6 md:mb-8">
                  <h3 className="text-2xl md:text-3xl">Reservados e Vendidos</h3>
                  <span className="text-sm text-gray-500">{unavailableProperties.length}</span>
                </div>
                {renderRow(unavailableProperties)}
              </div>
            )}
          </>
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
