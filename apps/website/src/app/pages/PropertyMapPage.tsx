"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, ArrowLeft, SlidersHorizontal, X, ChevronDown, Search, Check } from 'lucide-react';
import { PropertyMapView, MapProperty, pointInPolygon, PropertyMapViewHandle } from '../components/PropertyMapView';
import { PropertyModal } from '../components/PropertyModal';
import { SimpleSearchBar } from '../components/SimpleSearchBar';
import { InfinityLoader } from '../components/InfinityLoader';
import { useProperties } from '../../hooks/useProperties';

export function PropertyMapPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { properties: dbProperties, loading: dbLoading } = useProperties();
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [drawPolygon, setDrawPolygon] = useState<[number, number][]>([]);
  const mapRef = useRef<PropertyMapViewHandle>(null);
  const [advancedFilters, setAdvancedFilters] = useState<any>({});
  const [filter, setFilter] = useState<'all' | 'sale' | 'rent'>('all');
  const [hoveredCardId, setHoveredCardId] = useState<string | number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Desktop sidebar filter state
  const [sidebarTab, setSidebarTab] = useState<'filters' | 'results'>('results');
  const [localLocations, setLocalLocations] = useState<string[]>([]);
  const [localType, setLocalType] = useState('');
  const [localTypologies, setLocalTypologies] = useState<string[]>([]);
  const [localPriceMin, setLocalPriceMin] = useState('');
  const [localPriceMax, setLocalPriceMax] = useState('');
  const [localSizeMin, setLocalSizeMin] = useState('');
  const [localSizeMax, setLocalSizeMax] = useState('');
  const [localConditions, setLocalConditions] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState('');
  const [openFilterSection, setOpenFilterSection] = useState<string | null>(null);

  // Get URL search params
  const urlLocation = searchParams.get('location');
  const urlType = searchParams.get('type');
  const urlTypology = searchParams.get('typology');
  const urlPrice = searchParams.get('price');
  const urlTransaction = searchParams.get('transaction');

  useEffect(() => {
    if (urlTransaction === 'buy') setFilter('sale');
    else if (urlTransaction === 'rent') setFilter('rent');
  }, [urlTransaction]);

  // Sync local sidebar filters from URL on mount
  useEffect(() => {
    if (urlLocation) setLocalLocations(urlLocation.split(',').filter(Boolean));
    if (urlType) setLocalType(urlType);
    if (urlTypology) setLocalTypologies(urlTypology.split(',').filter(Boolean));
    if (urlPrice && urlPrice !== 'all') {
      const [min, max] = urlPrice.split('-');
      if (min) setLocalPriceMin(min);
      if (max && max !== '999999999') setLocalPriceMax(max);
    }
  }, []);

  // Normalize for dedup
  const normalizeText = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const deduplicateValues = (values: string[]): string[] => {
    const map = new window.Map<string, string>();
    for (const val of values) {
      const key = normalizeText(val);
      const existing = map.get(key);
      if (!existing || val.length > existing.length) map.set(key, val);
    }
    return Array.from(map.values()).map(v => v.charAt(0).toUpperCase() + v.slice(1));
  };

  // Extract unique filter values from all DB properties
  const uniqueLocations = useMemo(() =>
    deduplicateValues(dbProperties.map(p => p.city || p.zone || p.locality).filter(Boolean))
      .sort((a, b) => a.localeCompare(b, 'pt-PT')),
    [dbProperties]);

  const uniquePropertyTypes = useMemo(() =>
    deduplicateValues(dbProperties.map(p => p.property_type).filter(Boolean))
      .sort((a, b) => a.localeCompare(b, 'pt-PT')),
    [dbProperties]);

  const uniqueTypologies = useMemo(() =>
    deduplicateValues(dbProperties.map(p => p.typology).filter(Boolean))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
      }),
    [dbProperties]);

  const uniqueConditions = useMemo(() =>
    Array.from(new Set(dbProperties.map(p => p.property_condition || p.building_condition).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-PT')),
    [dbProperties]);

  const formatCondition = (raw: string) =>
    raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/^./, c => c.toUpperCase());

  // Apply sidebar filters to URL
  const applySidebarFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (localLocations.length > 0) params.set('location', localLocations.join(','));
    if (localType) params.set('type', localType);
    if (localTypologies.length > 0) params.set('typology', localTypologies.join(','));
    const priceRange = (localPriceMin || localPriceMax)
      ? `${localPriceMin || '0'}-${localPriceMax || '999999999'}`
      : '';
    if (priceRange) params.set('price', priceRange);
    params.set('transaction', filter === 'rent' ? 'rent' : 'buy');
    router.push(`/property/map?${params.toString()}`);
  }, [localLocations, localType, localTypologies, localPriceMin, localPriceMax, filter, router]);

  // Auto-apply sidebar filters on change
  const isFirstSidebarRender = useRef(true);
  useEffect(() => {
    if (isFirstSidebarRender.current) { isFirstSidebarRender.current = false; return; }
    applySidebarFilters();
  }, [localLocations, localType, localTypologies, localPriceMin, localPriceMax, filter]);

  // Apply size/condition from sidebar to advancedFilters
  useEffect(() => {
    setAdvancedFilters((prev: any) => ({
      ...prev,
      sizeMin: localSizeMin ? parseInt(localSizeMin) : undefined,
      sizeMax: localSizeMax ? parseInt(localSizeMax) : undefined,
      condition: localConditions,
    }));
  }, [localSizeMin, localSizeMax, localConditions]);

  const handleSearch = useCallback((filters: {
    location: string;
    propertyType: string;
    typology: string;
    priceRange: string;
    transactionType: 'buy' | 'rent';
  }) => {
    const params = new URLSearchParams();
    if (filters.location && filters.location !== 'Localização') params.set('location', filters.location);
    if (filters.propertyType && filters.propertyType !== 'Tipo') params.set('type', filters.propertyType);
    if (filters.typology && filters.typology !== 'Tipologia') params.set('typology', filters.typology);
    if (filters.priceRange && filters.priceRange !== 'all') params.set('price', filters.priceRange);
    params.set('transaction', filters.transactionType);
    router.push(`/property/map?${params.toString()}`);
  }, [router]);

  const handleAdvancedFilterChange = useCallback((filters: any) => {
    setAdvancedFilters(filters);
  }, []);

  const goBackToGrid = () => {
    const params = searchParams.toString();
    router.push(`/property${params ? `?${params}` : ''}`);
  };

  const normalize = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Convert and filter properties
  const allProperties = useMemo(() => {
    return dbProperties
      .filter(p => p.show_on_website === true)
      .filter(p => p.external_ref)
      .filter(p => ['active', 'reserved', 'sold', 'rented'].includes(p.status?.toLowerCase()))
      .map((dbProp: any) => {
        const isRent = dbProp.business_type?.toLowerCase().includes('arrendamento');
        return {
          id: dbProp.id,
          title: dbProp.title || 'Imóvel Disponível',
          location: `${dbProp.locality || dbProp.city || 'Lisboa'}, Portugal`,
          price: isRent
            ? `€${(dbProp.listing_price || dbProp.asking_price || 0).toLocaleString('pt-PT')}/mês`
            : `€${(dbProp.listing_price || dbProp.asking_price || 0).toLocaleString('pt-PT')}`,
          priceValue: dbProp.listing_price || dbProp.asking_price || 0,
          image: (dbProp.media && dbProp.media.length > 0)
            ? (dbProp.media.find((m: any) => m.is_cover)?.url || dbProp.media[0].url)
            : (dbProp.main_image_url || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80'),
          beds: dbProp.bedrooms || 0,
          baths: dbProp.bathrooms_count || dbProp.wc_count || dbProp.bathrooms || 0,
          area_bruta: dbProp.area_gross || dbProp.area_bruta || dbProp.gross_area || dbProp.area || 0,
          type: isRent ? 'rent' : 'sale',
          typology: dbProp.typology,
          propertyType: dbProp.property_type,
          externalRef: dbProp.external_ref,
          state: dbProp.status,
          slug: dbProp.slug,
          latitude: dbProp.latitude,
          longitude: dbProp.longitude,
          energyCertificate: dbProp.energy_certificate,
          yearBuilt: dbProp.construction_year,
          equipment: dbProp.equipment,
          consultantName: dbProp.consultant_name,
          consultantId: dbProp.consultant_id,
          description: dbProp.description,
          propertyCondition: dbProp.property_condition || dbProp.building_condition,
        };
      });
  }, [dbProperties]);

  // Apply filters
  const filteredProperties = useMemo(() => {
    return allProperties.filter((property: any) => {
      if (filter !== 'all' && property.type !== filter) return false;

      if (urlLocation && urlLocation !== 'All Locations') {
        const locations = urlLocation.split(',').map(l => normalize(l));
        if (!locations.some(loc => normalize(property.location).includes(loc))) return false;
      }

      if (urlType && urlType !== 'All Types' && urlType !== 'Tipo') {
        if (!normalize(property.propertyType || '').includes(normalize(urlType))) return false;
      }

      if (urlTypology && urlTypology !== 'All Typologies' && urlTypology !== 'Tipologia') {
        const selectedTypologies = urlTypology.split(',').map(t => normalize(t.trim()));
        const propTypology = normalize(property.typology || '');
        if (!selectedTypologies.some(t => propTypology.includes(t))) return false;
      }

      if (urlPrice && urlPrice !== 'all') {
        const [min, max] = urlPrice.split('-').map(Number);
        if (property.priceValue < min || property.priceValue > max) return false;
      }

      if (advancedFilters.sizeMin && property.area_bruta < advancedFilters.sizeMin) return false;
      if (advancedFilters.sizeMax && property.area_bruta > advancedFilters.sizeMax) return false;

      if (advancedFilters.condition && advancedFilters.condition.length > 0) {
        const propCondition = (property.propertyCondition || '').toLowerCase();
        if (!advancedFilters.condition.some((cond: string) => propCondition.includes(cond.toLowerCase()))) return false;
      }

      if (advancedFilters.extras && advancedFilters.extras.length > 0) {
        const equipment = property.equipment || '';
        const equipmentArray = typeof equipment === 'string'
          ? equipment.split(/[,;|\n]/).map((e: string) => e.trim().toLowerCase())
          : [];
        if (!advancedFilters.extras.some((extra: string) =>
          equipmentArray.some((e: string) => e.includes(extra.toLowerCase()))
        )) return false;
      }

      if (advancedFilters.referenceId) {
        if (!(property.externalRef || '').toString().includes(advancedFilters.referenceId.trim())) return false;
      }

      // Draw polygon filter
      if (drawPolygon.length >= 3 && property.latitude && property.longitude) {
        if (!pointInPolygon([property.longitude, property.latitude], drawPolygon)) return false;
      }

      return true;
    });
  }, [allProperties, filter, urlLocation, urlType, urlTypology, urlPrice, advancedFilters, drawPolygon]);

  const isInsideDrawArea = useCallback((property: any) => {
    if (drawPolygon.length < 3 || !property.latitude || !property.longitude) return false;
    return pointInPolygon([property.longitude, property.latitude], drawPolygon);
  }, [drawPolygon]);

  const sortedProperties = useMemo(() => {
    return [...filteredProperties].sort((a: any, b: any) => {
      if (drawPolygon.length >= 3) {
        const aInside = isInsideDrawArea(a);
        const bInside = isInsideDrawArea(b);
        if (aInside && !bInside) return -1;
        if (!aInside && bInside) return 1;
      }
      const getRefNumber = (ref: string | undefined): number => {
        if (!ref) return 0;
        const match = ref.match(/-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      };
      return getRefNumber(b.externalRef) - getRefNumber(a.externalRef);
    });
  }, [filteredProperties, drawPolygon, isInsideDrawArea]);

  const mapProperties: MapProperty[] = sortedProperties.filter(
    (p: any) => p.latitude && p.longitude
  );

  const handlePropertyClick = (property: MapProperty) => {
    const fullProp = sortedProperties.find((p: any) => p.id === property.id);
    if (fullProp) setSelectedProperty(fullProp);
  };

  const handleDrawFilter = (polygon: [number, number][]) => {
    setDrawPolygon(polygon);
  };

  if (dbLoading) {
    return (
      <div className="pt-24 min-h-screen bg-gray-50 dark:bg-gray-900">
        <InfinityLoader />
      </div>
    );
  }

  // Shared card renderer
  const PropertyCard = ({ property, compact = false }: { property: any; compact?: boolean }) => {
    const isReserved = ['reserved', 'rented'].includes(property.state?.toLowerCase() || '');
    const displayPrice = isReserved ? 'Sob Consulta' : property.price;

    if (compact) {
      // Mobile 2-col grid card
      return (
        <div
          onClick={() => setSelectedProperty(property)}
          className={`bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm cursor-pointer transition-all border ${
            drawPolygon.length >= 3 && !isInsideDrawArea(property)
              ? 'border-gray-100 dark:border-gray-700 opacity-40'
              : drawPolygon.length >= 3 && isInsideDrawArea(property)
                ? 'border-black/30 dark:border-white/30 shadow-md'
                : 'border-gray-100 dark:border-gray-700 hover:shadow-md'
          }`}
        >
          <div className="relative aspect-[4/3] overflow-hidden">
            <img src={property.image} alt={property.title} className="w-full h-full object-cover" />
            {isReserved && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <span className="text-white text-xs font-medium">{property.state?.toLowerCase() === 'reserved' ? 'Reservado' : 'Arrendado'}</span>
              </div>
            )}
            {!isReserved && (
              <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[10px] font-medium border border-white/20">
                {property.type === 'sale' ? 'Venda' : 'Arrendamento'}
              </div>
            )}
          </div>
          <div className="p-2.5">
            <h4 className="text-xs font-semibold truncate dark:text-white">{property.title}</h4>
            <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              <MapPin size={8} />
              <span className="truncate">{property.location}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500 mt-1">
              {property.typology && <span>{property.typology}</span>}
              {property.area_bruta > 0 && <span>{property.area_bruta} m²</span>}
            </div>
            <div className="text-sm font-bold mt-1 dark:text-white">{displayPrice}</div>
          </div>
        </div>
      );
    }

    // Desktop sidebar card
    return (
      <div
        onClick={() => setSelectedProperty(property)}
        onMouseEnter={() => {
          setHoveredCardId(property.id);
          if (property.latitude && property.longitude) {
            mapRef.current?.flyToProperty(property.id);
          }
        }}
        onMouseLeave={() => {
          setHoveredCardId(null);
          mapRef.current?.clearHighlight();
        }}
        className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
          hoveredCardId === property.id
            ? 'border-black dark:border-white bg-gray-50 dark:bg-gray-700 shadow-md'
            : drawPolygon.length >= 3 && isInsideDrawArea(property)
              ? 'border-black/30 dark:border-white/30 bg-gray-50/50 dark:bg-gray-700/50 shadow-sm'
              : drawPolygon.length >= 3 && !isInsideDrawArea(property)
                ? 'border-gray-100 dark:border-gray-700 opacity-40'
                : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
        }`}
      >
        <div className="relative w-28 h-20 rounded-lg overflow-hidden shrink-0">
          <img src={property.image} alt={property.title} className="w-full h-full object-cover" />
          {isReserved && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-[10px] font-medium">{property.state?.toLowerCase() === 'reserved' ? 'Reservado' : 'Arrendado'}</span>
            </div>
          )}
          {!property.latitude && (
            <div className="absolute bottom-1 right-1 bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-[9px] font-medium">
              Sem mapa
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold truncate dark:text-white">{property.title}</h4>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <MapPin size={10} />
            <span className="truncate">{property.location}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-1">
            {property.typology && <span>{property.typology}</span>}
            {property.area_bruta > 0 && <span>{property.area_bruta} m²</span>}
          </div>
          <div className="text-sm font-bold mt-1 dark:text-white">{displayPrice}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ──────────── MOBILE LAYOUT ──────────── */}
      <div className="lg:hidden flex flex-col overflow-auto">
        {/* Mobile compact bar above map */}
        <div className="shrink-0 flex items-center justify-between px-3 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={goBackToGrid}
            className="flex items-center justify-center w-9 h-9 bg-black/40 backdrop-blur-md text-white rounded-full border border-white/20 drop-shadow-lg hover:bg-black/60 transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">{sortedProperties.length} imóveis</span>
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <SlidersHorizontal size={12} />
              Filtros
            </button>
          </div>
        </div>

        {/* Mobile map frame */}
        <div className="h-[40vh] min-h-[250px] shrink-0">
          <PropertyMapView
            ref={mapRef}
            properties={mapProperties}
            onPropertyClick={handlePropertyClick}
            onDrawFilter={handleDrawFilter}
          />
        </div>

        {/* Mobile 2-col property grid */}
        <div className="p-3">
          {sortedProperties.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {sortedProperties.map((property: any) => (
                <PropertyCard key={property.id} property={property} compact />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum imóvel encontrado</p>
              {drawPolygon.length >= 3 && (
                <button onClick={() => setDrawPolygon([])} className="mt-2 text-sm text-indigo-600 hover:underline">
                  Limpar área desenhada
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ──────────── DESKTOP LAYOUT ──────────── */}
      <div className="hidden lg:flex flex-1 flex-row overflow-hidden">
        {/* Desktop sidebar */}
        <div className="w-[320px] xl:w-[340px] flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* Sidebar header */}
          <div className="shrink-0 px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
            <button onClick={goBackToGrid} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Voltar às Propriedades">
              <ArrowLeft size={18} />
            </button>
            <span className="text-sm font-medium dark:text-white flex-1">
              {sortedProperties.length} imóveis
            </span>
            {/* Tab toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setSidebarTab('filters')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  sidebarTab === 'filters' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Filtros
              </button>
              <button
                onClick={() => setSidebarTab('results')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  sidebarTab === 'results' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Lista
              </button>
            </div>
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
            {sidebarTab === 'filters' ? (
              /* ── Vertical filter panel ── */
              <div className="p-4 space-y-4 min-w-0 overflow-hidden">
                {/* Buy / Rent */}
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Tipo de operação</label>
                  <div className="flex gap-2">
                    <button onClick={() => setFilter('sale')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${filter !== 'rent' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>Comprar</button>
                    <button onClick={() => setFilter('rent')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'rent' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>Arrendar</button>
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Zona</label>
                  <div className="relative">
                    <button
                      onClick={() => setOpenFilterSection(openFilterSection === 'location' ? null : 'location')}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm border border-gray-200 dark:border-gray-600"
                    >
                      <span className={localLocations.length > 0 ? 'text-black dark:text-white' : 'text-gray-400'}>
                        {localLocations.length > 0 ? `${localLocations.length} zona(s)` : 'Todas as zonas'}
                      </span>
                      <ChevronDown size={14} className={`text-gray-400 transition-transform ${openFilterSection === 'location' ? 'rotate-180' : ''}`} />
                    </button>
                    {openFilterSection === 'location' && (
                      <div className="mt-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <Search size={12} className="text-gray-400" />
                            <input type="text" value={locationSearch} onChange={e => setLocationSearch(e.target.value)} placeholder="Pesquisar..." className="w-full bg-transparent text-xs focus:outline-none" />
                          </div>
                        </div>
                        {localLocations.length > 0 && (
                          <div className="px-2 pt-2 pb-1 flex flex-wrap gap-1">
                            {localLocations.map(loc => (
                              <button key={loc} onClick={() => setLocalLocations(prev => prev.filter(l => l !== loc))} className="flex items-center gap-1 px-2 py-0.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-[10px] font-medium">
                                {loc}<X size={10} />
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="max-h-36 overflow-y-auto py-1">
                          {(locationSearch ? uniqueLocations.filter(l => normalizeText(l).includes(normalizeText(locationSearch))) : uniqueLocations).map(loc => (
                            <button key={loc} onClick={() => setLocalLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc])} className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <span>{loc}</span>
                              {localLocations.includes(loc) && <Check size={12} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Property Type */}
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Tipo de imóvel</label>
                  <select
                    value={localType}
                    onChange={e => setLocalType(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm border border-gray-200 dark:border-gray-600 focus:outline-none"
                  >
                    <option value="">Todos</option>
                    {uniquePropertyTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Typology */}
                <div className="min-w-0">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Tipologia</label>
                  <div className="flex flex-wrap gap-1.5 min-w-0">
                    {uniqueTypologies.map(typ => (
                      <button
                        key={typ}
                        onClick={() => setLocalTypologies(prev => prev.includes(typ) ? prev.filter(t => t !== typ) : [...prev, typ])}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          localTypologies.includes(typ)
                            ? 'bg-black dark:bg-white text-white dark:text-black'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {typ}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price */}
                <div className="min-w-0">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Preço</label>
                  <div className="flex gap-2 items-center min-w-0">
                    <div className="flex-1 min-w-0 flex items-center gap-1 px-2 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                      <span className="text-xs text-gray-400 shrink-0">€</span>
                      <input type="number" value={localPriceMin} onChange={e => setLocalPriceMin(e.target.value)} placeholder="Min" className="w-full min-w-0 bg-transparent text-xs focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                    <span className="text-gray-300 text-xs shrink-0">—</span>
                    <div className="flex-1 min-w-0 flex items-center gap-1 px-2 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                      <span className="text-xs text-gray-400 shrink-0">€</span>
                      <input type="number" value={localPriceMax} onChange={e => setLocalPriceMax(e.target.value)} placeholder="Max" className="w-full min-w-0 bg-transparent text-xs focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                  </div>
                </div>

                {/* Size */}
                <div className="min-w-0">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Área (m²)</label>
                  <div className="flex gap-2 items-center min-w-0">
                    <input type="number" value={localSizeMin} onChange={e => setLocalSizeMin(e.target.value)} placeholder="Min" className="flex-1 min-w-0 px-2 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs border border-gray-200 dark:border-gray-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <span className="text-gray-300 text-xs shrink-0">—</span>
                    <input type="number" value={localSizeMax} onChange={e => setLocalSizeMax(e.target.value)} placeholder="Max" className="flex-1 min-w-0 px-2 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs border border-gray-200 dark:border-gray-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                </div>

                {/* Condition */}
                {uniqueConditions.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Estado</label>
                    <div className="space-y-1">
                      {uniqueConditions.map(cond => (
                        <label key={cond} className="flex items-center gap-2 px-1 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg">
                          <input
                            type="checkbox"
                            checked={localConditions.includes(cond)}
                            onChange={() => setLocalConditions(prev => prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond])}
                            className="rounded border-gray-300"
                          />
                          <span className="text-xs">{formatCondition(cond)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clear all */}
                {(localLocations.length > 0 || localType || localTypologies.length > 0 || localPriceMin || localPriceMax || localSizeMin || localSizeMax || localConditions.length > 0) && (
                  <button
                    onClick={() => {
                      setLocalLocations([]); setLocalType(''); setLocalTypologies([]);
                      setLocalPriceMin(''); setLocalPriceMax('');
                      setLocalSizeMin(''); setLocalSizeMax('');
                      setLocalConditions([]); setLocationSearch('');
                    }}
                    className="w-full text-xs text-gray-500 hover:text-black dark:hover:text-white py-2 transition-colors underline"
                  >
                    Limpar todos os filtros
                  </button>
                )}
              </div>
            ) : (
              /* ── Results list ── */
              <div className="p-4">
                <div className="flex flex-col gap-3">
                  {sortedProperties.map((property: any) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}

                  {sortedProperties.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum imóvel encontrado</p>
                      {drawPolygon.length >= 3 && (
                        <button onClick={() => setDrawPolygon([])} className="mt-2 text-sm text-indigo-600 hover:underline">
                          Limpar área desenhada
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop map */}
        <div className="flex-1">
          <PropertyMapView
            ref={mapRef}
            properties={mapProperties}
            onPropertyClick={handlePropertyClick}
            onDrawFilter={handleDrawFilter}
          />
        </div>
      </div>

      {/* ──────────── FILTER SHEET (mobile only) ──────────── */}
      {showFilters && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Sheet header */}
            <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-semibold dark:text-white">Filtros</h3>
              <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Buy/Sell toggle */}
            <div className="shrink-0 px-5 pt-4 pb-2">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFilter('sale');
                    const params = new URLSearchParams(searchParams);
                    params.set('transaction', 'buy');
                    router.push(`/property/map?${params.toString()}`);
                  }}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                    filter === 'sale' || filter === 'all'
                      ? 'bg-black dark:bg-white text-white dark:text-black'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  Comprar
                </button>
                <button
                  onClick={() => {
                    setFilter('rent');
                    const params = new URLSearchParams(searchParams);
                    params.set('transaction', 'rent');
                    router.push(`/property/map?${params.toString()}`);
                  }}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                    filter === 'rent'
                      ? 'bg-black dark:bg-white text-white dark:text-black'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  Arrendar
                </button>
              </div>
            </div>

            {/* Filter sections (accordion style) */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3 pt-2">
              {/* Zona */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
                <button onClick={() => setOpenFilterSection(openFilterSection === 'mob-location' ? null : 'mob-location')} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <MapPin size={18} className="text-gray-400" />
                    <span className="text-sm font-medium">Zona</span>
                    {localLocations.length > 0 && <span className="text-xs text-gray-400">{localLocations.length} selecionada(s)</span>}
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${openFilterSection === 'mob-location' ? 'rotate-180' : ''}`} />
                </button>
                {openFilterSection === 'mob-location' && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <Search size={14} className="text-gray-400 shrink-0" />
                        <input type="text" value={locationSearch} onChange={e => setLocationSearch(e.target.value)} placeholder="Pesquisar zona..." className="w-full bg-transparent text-sm focus:outline-none" />
                        {locationSearch && <button onClick={() => setLocationSearch('')} className="text-gray-400"><X size={14} /></button>}
                      </div>
                    </div>
                    {localLocations.length > 0 && (
                      <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5">
                        {localLocations.map(loc => (
                          <button key={loc} onClick={() => setLocalLocations(prev => prev.filter(l => l !== loc))} className="flex items-center gap-1 px-2.5 py-1 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-medium">
                            {loc}<X size={11} />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="max-h-52 overflow-y-auto py-1">
                      {(locationSearch ? uniqueLocations.filter(l => normalizeText(l).includes(normalizeText(locationSearch))) : uniqueLocations).map(loc => (
                        <button key={loc} onClick={() => setLocalLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc])} className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${localLocations.includes(loc) ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                          <span>{loc}</span>
                          {localLocations.includes(loc) && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tipo */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
                <button onClick={() => setOpenFilterSection(openFilterSection === 'mob-type' ? null : 'mob-type')} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-lg">&#8962;</span>
                    <span className="text-sm font-medium">Tipo</span>
                    {localType && <span className="text-xs text-gray-400">{localType}</span>}
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${openFilterSection === 'mob-type' ? 'rotate-180' : ''}`} />
                </button>
                {openFilterSection === 'mob-type' && (
                  <div className="border-t border-gray-100 dark:border-gray-700 max-h-52 overflow-y-auto py-1">
                    <button onClick={() => setLocalType('')} className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${!localType ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                      <span>Todos</span>
                      {!localType && <Check size={16} />}
                    </button>
                    {uniquePropertyTypes.map(t => (
                      <button key={t} onClick={() => setLocalType(t)} className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${localType === t ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                        <span>{t}</span>
                        {localType === t && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tipologia */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
                <button onClick={() => setOpenFilterSection(openFilterSection === 'mob-typology' ? null : 'mob-typology')} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-lg">&#9632;</span>
                    <span className="text-sm font-medium">Tipologia</span>
                    {localTypologies.length > 0 && <span className="text-xs text-gray-400">{localTypologies.join(', ')}</span>}
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${openFilterSection === 'mob-typology' ? 'rotate-180' : ''}`} />
                </button>
                {openFilterSection === 'mob-typology' && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-3">
                    <div className="flex flex-wrap gap-2">
                      {uniqueTypologies.map(typ => (
                        <button key={typ} onClick={() => setLocalTypologies(prev => prev.includes(typ) ? prev.filter(t => t !== typ) : [...prev, typ])} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${localTypologies.includes(typ) ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                          {typ}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Preço */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
                <button onClick={() => setOpenFilterSection(openFilterSection === 'mob-price' ? null : 'mob-price')} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-lg">€</span>
                    <span className="text-sm font-medium">Preço</span>
                    {(localPriceMin || localPriceMax) && <span className="text-xs text-gray-400">{localPriceMin ? `€${parseInt(localPriceMin).toLocaleString('pt-PT')}` : '€0'} - {localPriceMax ? `€${parseInt(localPriceMax).toLocaleString('pt-PT')}` : '∞'}</span>}
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${openFilterSection === 'mob-price' ? 'rotate-180' : ''}`} />
                </button>
                {openFilterSection === 'mob-price' && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 mb-1 block">Mínimo</label>
                        <div className="flex items-center gap-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                          <span className="text-sm text-gray-400">€</span>
                          <input type="number" value={localPriceMin} onChange={e => setLocalPriceMin(e.target.value)} placeholder="0" className="w-full bg-transparent text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        </div>
                      </div>
                      <div className="flex items-end pb-2.5 text-gray-300">—</div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 mb-1 block">Máximo</label>
                        <div className="flex items-center gap-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                          <span className="text-sm text-gray-400">€</span>
                          <input type="number" value={localPriceMax} onChange={e => setLocalPriceMax(e.target.value)} placeholder="Sem limite" className="w-full bg-transparent text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        </div>
                      </div>
                    </div>
                    {(localPriceMin || localPriceMax) && (
                      <button onClick={() => { setLocalPriceMin(''); setLocalPriceMax(''); }} className="w-full text-sm text-gray-500 hover:text-black dark:hover:text-white py-1 transition-colors">Limpar preço</button>
                    )}
                  </div>
                )}
              </div>

              {/* Área + Estado */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
                <button onClick={() => setOpenFilterSection(openFilterSection === 'mob-advanced' ? null : 'mob-advanced')} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <SlidersHorizontal size={18} className="text-gray-400" />
                    <span className="text-sm font-medium">Filtros Avançados</span>
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${openFilterSection === 'mob-advanced' ? 'rotate-180' : ''}`} />
                </button>
                {openFilterSection === 'mob-advanced' && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">Área (m²)</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <input type="number" value={localSizeMin} onChange={e => setLocalSizeMin(e.target.value)} placeholder="Min" className="w-full bg-transparent text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <span className="text-xs text-gray-400">m²</span>
                          </div>
                        </div>
                        <div className="flex items-center text-gray-300">—</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <input type="number" value={localSizeMax} onChange={e => setLocalSizeMax(e.target.value)} placeholder="Max" className="w-full bg-transparent text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <span className="text-xs text-gray-400">m²</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {uniqueConditions.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Estado</label>
                        <div className="space-y-1">
                          {uniqueConditions.map(cond => (
                            <label key={cond} className="flex items-center gap-2.5 px-1 py-2 cursor-pointer">
                              <input type="checkbox" checked={localConditions.includes(cond)} onChange={() => setLocalConditions(prev => prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond])} className="rounded border-gray-300" />
                              <span className="text-sm">{formatCondition(cond)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Apply button */}
            <div className="shrink-0 border-t border-gray-100 dark:border-gray-700 p-4">
              <button
                onClick={() => setShowFilters(false)}
                className="w-full bg-black dark:bg-white text-white dark:text-black px-6 py-4 rounded-2xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium text-sm"
              >
                Ver {sortedProperties.length} imóveis
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Property Modal */}
      {selectedProperty && (
        <PropertyModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </div>
  );
}
