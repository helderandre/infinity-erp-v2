"use client";

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, MapPin, Home, ChevronDown, Building, SlidersHorizontal, X, Euro, Check, Map as MapIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { AdvancedFilters } from './AdvancedFilters';

interface SimpleSearchBarProps {
  properties: any[];
  resultCount?: number;
  onSearch?: (filters: {
    location: string;
    propertyType: string;
    typology: string;
    priceRange: string;
    transactionType: 'buy' | 'rent';
  }) => void;
  onAdvancedFilterChange?: (filters: any) => void;
  showMapButton?: boolean;
  onMapClick?: () => void;
}

type DropdownId = 'location' | 'type' | 'typology' | 'price' | null;

export function SimpleSearchBar({ properties, resultCount, onSearch, onAdvancedFilterChange, showMapButton, onMapClick }: SimpleSearchBarProps) {
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  // Initialize state from URL params
  const [activeTab, setActiveTab] = useState<'buy' | 'rent'>(
    searchParams.get('transaction') === 'rent' ? 'rent' : 'buy'
  );
  const [selectedLocations, setSelectedLocations] = useState<string[]>(
    searchParams.get('location') ? searchParams.get('location')!.split(',').filter(Boolean) : []
  );
  const [propertyType, setPropertyType] = useState(searchParams.get('type') || '');
  const [selectedTypologies, setSelectedTypologies] = useState<string[]>(
    searchParams.get('typology') ? searchParams.get('typology')!.split(',').filter(Boolean) : []
  );
  const initPrice = searchParams.get('price');
  const [priceMin, setPriceMin] = useState(initPrice && initPrice !== 'all' ? initPrice.split('-')[0] || '' : '');
  const [priceMax, setPriceMax] = useState(initPrice && initPrice !== 'all' ? initPrice.split('-')[1] || '' : '');

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null);
  const [showMobileFilterSheet, setShowMobileFilterSheet] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [mobileOpenSection, setMobileOpenSection] = useState<string | null>(null);

  // Normalize text for accent-insensitive comparison
  const normalizeText = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Deduplicate values that differ only by case/accents.
  // Picks the best canonical form: prefers accented over plain, capitalized first letter.
  const deduplicateValues = (values: string[]): string[] => {
    const map = new Map<string, string>();
    for (const val of values) {
      const key = normalizeText(val);
      const existing = map.get(key);
      if (!existing || scoreName(val) > scoreName(existing)) {
        map.set(key, val);
      }
    }
    // Ensure first letter uppercase
    return Array.from(map.values()).map(v => v.charAt(0).toUpperCase() + v.slice(1));
  };

  // Score a name variant: more accents = better, first char uppercase = better
  const scoreName = (val: string): number => {
    let score = 0;
    // Prefer accented characters (has diacritics)
    score += (val.match(/[À-ÿ]/g) || []).length * 10;
    // Prefer first character uppercase
    if (val[0] === val[0].toUpperCase()) score += 5;
    return score;
  };

  // Extract unique values from properties
  const uniqueLocations = deduplicateValues(
    properties.map(p => p.city || p.zone || p.locality).filter(Boolean)
  ).sort((a, b) => a.localeCompare(b, 'pt-PT'));

  const filteredLocations = locationSearch
    ? uniqueLocations.filter(loc => normalizeText(loc).includes(normalizeText(locationSearch)))
    : uniqueLocations;

  const uniquePropertyTypes = deduplicateValues(
    properties.map(p => p.property_type).filter(Boolean)
  ).sort((a, b) => a.localeCompare(b, 'pt-PT'));

  const uniqueTypologies = deduplicateValues(
    properties.map(p => p.typology).filter(Boolean)
  ).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  // Quick-pick price suggestions
  const buyPresets = ['50000', '100000', '150000', '200000', '300000', '500000', '750000', '1000000'];
  const rentPresets = ['500', '750', '1000', '1500', '2000', '3000', '5000'];
  const pricePresets = activeTab === 'buy' ? buyPresets : rentPresets;

  // Derive the URL price param from min/max
  const priceRange = (priceMin || priceMax)
    ? `${priceMin || '0'}-${priceMax || '999999999'}`
    : 'all';

  const formatPrice = (val: string) => {
    const num = parseInt(val);
    if (isNaN(num)) return val;
    if (num >= 1000000) return `€${(num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1)}M`;
    return `€${num.toLocaleString('pt-PT')}`;
  };

  // Toggles
  const toggleLocation = (loc: string) => {
    setSelectedLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]);
  };
  const toggleTypology = (typ: string) => {
    setSelectedTypologies(prev => prev.includes(typ) ? prev.filter(t => t !== typ) : [...prev, typ]);
  };
  const toggleDropdown = (id: DropdownId) => {
    setOpenDropdown(prev => prev === id ? null : id);
    if (id !== 'location') setLocationSearch('');
  };
  const closeDropdown = () => { setOpenDropdown(null); setLocationSearch(''); };

  // Auto-search on filter change (skip first render)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    triggerSearch();
  }, [activeTab, selectedLocations, propertyType, selectedTypologies, priceMin, priceMax]);

  const triggerSearch = () => {
    onSearch?.({
      location: selectedLocations.length > 0 ? selectedLocations.join(',') : 'Localização',
      propertyType: propertyType || 'Tipo',
      typology: selectedTypologies.length > 0 ? selectedTypologies.join(',') : 'Tipologia',
      priceRange,
      transactionType: activeTab,
    });
  };

  const handleSearch = () => {
    setShowMobileFilterSheet(false);
    setShowAdvancedFilters(false);
    closeDropdown();
    triggerSearch();
  };

  const clearAllFilters = () => {
    setSelectedLocations([]);
    setPropertyType('');
    setSelectedTypologies([]);
    setPriceMin('');
    setPriceMax('');
    setLocationSearch('');
  };

  const hasPriceFilter = priceMin !== '' || priceMax !== '';

  const hasActiveFilters =
    selectedLocations.length > 0 || propertyType !== '' || selectedTypologies.length > 0 || hasPriceFilter;

  const activeFilterCount =
    (selectedLocations.length > 0 ? 1 : 0) +
    (propertyType !== '' ? 1 : 0) +
    (selectedTypologies.length > 0 ? 1 : 0) +
    (hasPriceFilter ? 1 : 0);

  const getPriceLabel = () => {
    if (priceMin && priceMax) return `${formatPrice(priceMin)} - ${formatPrice(priceMax)}`;
    if (priceMin) return `Desde ${formatPrice(priceMin)}`;
    if (priceMax) return `Até ${formatPrice(priceMax)}`;
    return 'Preço';
  };

  // ─── Shared dropdown renderers ───

  // ─── Modern multi-select item ───
  const SelectItem = ({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
        selected
          ? 'bg-black/5 dark:bg-white/10 text-black dark:text-white'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
      }`}
    >
      <span>{label}</span>
      {selected && <Check size={16} className="text-black dark:text-white flex-shrink-0" />}
    </button>
  );

  const renderLocationList = (maxHeight: string) => (
    <>
      {/* Search */}
      <div className="p-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input type="text" aria-label="Pesquisar zona" value={locationSearch} onChange={e => setLocationSearch(e.target.value)} placeholder="Pesquisar zona..." className="w-full bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400" autoFocus />
          {locationSearch && <button onClick={() => setLocationSearch('')} aria-label="Limpar pesquisa de zona" className="text-gray-400 hover:text-gray-600 transition-colors"><X size={14} /></button>}
        </div>
      </div>
      {/* Selected pills */}
      {selectedLocations.length > 0 && (
        <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5">
          {selectedLocations.map(loc => (
            <button key={loc} onClick={() => toggleLocation(loc)} className="flex items-center gap-1 px-2.5 py-1 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-medium hover:opacity-80 transition-opacity">
              {loc}
              <X size={11} />
            </button>
          ))}
        </div>
      )}
      {/* Options */}
      <div className={`overflow-y-auto ${maxHeight} py-1`}>
        {filteredLocations.length > 0 ? filteredLocations.map(loc => (
          <SelectItem key={loc} label={loc} selected={selectedLocations.includes(loc)} onClick={() => toggleLocation(loc)} />
        )) : <p className="px-4 py-3 text-sm text-gray-400">Nenhuma zona encontrada</p>}
      </div>
      {selectedLocations.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-2">
          <button onClick={() => setSelectedLocations([])} className="w-full text-sm text-gray-500 hover:text-black dark:hover:text-white py-1.5 transition-colors">Limpar seleção</button>
        </div>
      )}
    </>
  );

  const renderTypologyList = (maxHeight: string) => (
    <>
      {/* Selected pills */}
      {selectedTypologies.length > 0 && (
        <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5">
          {selectedTypologies.map(typ => (
            <button key={typ} onClick={() => toggleTypology(typ)} className="flex items-center gap-1 px-2.5 py-1 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-medium hover:opacity-80 transition-opacity">
              {typ}
              <X size={11} />
            </button>
          ))}
        </div>
      )}
      {/* Options */}
      <div className={`overflow-y-auto ${maxHeight} py-1`}>
        {uniqueTypologies.length > 0 ? uniqueTypologies.map(typ => (
          <SelectItem key={typ} label={typ} selected={selectedTypologies.includes(typ)} onClick={() => toggleTypology(typ)} />
        )) : <p className="px-4 py-3 text-sm text-gray-400">Sem tipologias disponíveis</p>}
      </div>
      {selectedTypologies.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-2">
          <button onClick={() => setSelectedTypologies([])} className="w-full text-sm text-gray-500 hover:text-black dark:hover:text-white py-1.5 transition-colors">Limpar seleção</button>
        </div>
      )}
    </>
  );

  const renderTypeList = () => (
    <div className="max-h-52 overflow-y-auto py-1">
      <SelectItem label="Todos" selected={propertyType === ''} onClick={() => setPropertyType('')} />
      {uniquePropertyTypes.map(t => (
        <SelectItem key={t} label={t} selected={propertyType === t} onClick={() => setPropertyType(t)} />
      ))}
    </div>
  );

  const renderPriceList = () => (
    <div className="p-3 space-y-3">
      {/* Min / Max inputs */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-400 font-medium mb-1 block">Mínimo</label>
          <div className="flex items-center gap-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <span className="text-sm text-gray-400">€</span>
            <input
              type="number"
              value={priceMin}
              onChange={e => setPriceMin(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
        <div className="flex items-end pb-2.5 text-gray-300">—</div>
        <div className="flex-1">
          <label className="text-xs text-gray-400 font-medium mb-1 block">Máximo</label>
          <div className="flex items-center gap-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <span className="text-sm text-gray-400">€</span>
            <input
              type="number"
              value={priceMax}
              onChange={e => setPriceMax(e.target.value)}
              placeholder="Sem limite"
              className="w-full bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>
      {/* Quick presets */}
      <div>
        <span className="text-xs text-gray-400 font-medium mb-2 block">Sugestões</span>
        <div className="flex flex-wrap gap-1.5">
          {pricePresets.map(val => {
            const isMinActive = priceMin === val;
            const isMaxActive = priceMax === val;
            return (
              <button
                key={val}
                onClick={() => {
                  if (isMinActive) { setPriceMin(''); return; }
                  if (isMaxActive) { setPriceMax(''); return; }
                  if (!priceMin) { setPriceMin(val); }
                  else if (!priceMax || parseInt(val) > parseInt(priceMin)) { setPriceMax(val); }
                  else { setPriceMin(val); }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isMinActive || isMaxActive
                    ? 'bg-black dark:bg-white text-white dark:text-black'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {formatPrice(val)}
              </button>
            );
          })}
        </div>
      </div>
      {/* Clear */}
      {hasPriceFilter && (
        <button onClick={() => { setPriceMin(''); setPriceMax(''); }} className="w-full text-sm text-gray-500 hover:text-black dark:hover:text-white py-1 transition-colors">
          Limpar preço
        </button>
      )}
    </div>
  );

  // Desktop dropdown wrapper — click outside closes, stopPropagation prevents parent toggle
  const DesktopDropdown = ({ children }: { children: React.ReactNode }) => (
    <>
      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); closeDropdown(); }} />
      <div
        className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200/80 dark:border-gray-700 z-50 min-w-[280px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );

  // Mobile accordion section helper (plain function, not a component — avoids remount on state change)
  const renderMobileSection = (id: string, icon: React.ReactNode, label: string, summary: string | undefined, content: React.ReactNode) => {
    const isOpen = mobileOpenSection === id;
    return (
      <div key={id} className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
        <button
          onClick={() => setMobileOpenSection(isOpen ? null : id)}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-gray-400">{icon}</span>
            <span className="text-sm font-medium">{label}</span>
            {summary && !isOpen && <span className="text-xs text-gray-400 truncate max-w-[140px]">{summary}</span>}
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className="border-t border-gray-100 dark:border-gray-700">
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl space-y-3">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
        {/* ──────────────── MOBILE ──────────────── */}
        <div className="md:hidden">
          <div className="flex items-center justify-between rounded-2xl overflow-hidden">
            <div className="flex gap-0 border-r border-gray-200 dark:border-gray-700">
              <button onClick={() => { setActiveTab('buy'); setPriceMin(''); setPriceMax(''); }} className={`px-4 py-4 text-sm transition-colors rounded-tl-2xl ${activeTab === 'buy' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                Comprar
              </button>
              <div className="w-px bg-gray-300 dark:bg-gray-600 my-3" />
              <button onClick={() => { setActiveTab('rent'); setPriceMin(''); setPriceMax(''); }} className={`px-4 py-4 text-sm transition-colors ${activeTab === 'rent' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                Arrendar
              </button>
            </div>
            <div className="flex-1" />
            <button onClick={() => setShowMobileFilterSheet(true)} className="relative px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-l border-gray-200 dark:border-gray-700 flex items-center justify-center" aria-label="Abrir filtros">
              <SlidersHorizontal size={20} className="text-gray-600 dark:text-gray-300" />
              {activeFilterCount > 0 && <span className="absolute top-2 right-2 w-5 h-5 bg-black dark:bg-white text-white dark:text-black text-xs rounded-full flex items-center justify-center font-medium">{activeFilterCount}</span>}
            </button>
            {showMapButton && onMapClick && (
              <button onClick={onMapClick} className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-l border-gray-200 dark:border-gray-700 flex items-center justify-center" aria-label="Ver no mapa">
                <MapIcon size={20} className="text-gray-600 dark:text-gray-300" />
              </button>
            )}
            <button onClick={handleSearch} className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-l border-gray-200 dark:border-gray-700 flex items-center justify-center rounded-tr-2xl rounded-br-2xl" aria-label="Pesquisar">
              <Search size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* ──────────── MOBILE FILTER SHEET ──────────── */}
        {showMobileFilterSheet && createPortal(
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Filtros de pesquisa">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" onClick={() => { setShowMobileFilterSheet(false); setShowAdvancedFilters(false); setLocationSearch(''); setMobileOpenSection(null); }} />
            <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden animate-slide-up">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-4 flex items-center justify-between z-10">
                <h3 className="text-lg font-semibold">Filtros</h3>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && <button onClick={clearAllFilters} className="text-sm text-gray-500 hover:text-black dark:hover:text-white transition-colors">Limpar tudo</button>}
                  <button onClick={() => { setShowMobileFilterSheet(false); setShowAdvancedFilters(false); setLocationSearch(''); setMobileOpenSection(null); }} aria-label="Fechar filtros" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={20} /></button>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[calc(85vh-140px)] p-4 space-y-3">
                {renderMobileSection('location', <MapPin size={18} />, 'Zona',
                  selectedLocations.length > 0 ? `${selectedLocations.length} selecionada(s)` : undefined,
                  renderLocationList('max-h-52')
                )}

                {renderMobileSection('type', <Home size={18} />, 'Tipo',
                  propertyType || undefined,
                  renderTypeList()
                )}

                {renderMobileSection('typology', <Building size={18} />, 'Tipologia',
                  selectedTypologies.length > 0 ? selectedTypologies.join(', ') : undefined,
                  renderTypologyList('max-h-52')
                )}

                {renderMobileSection('price', <Euro size={18} />, 'Preço',
                  hasPriceFilter ? getPriceLabel() : undefined,
                  renderPriceList()
                )}

                {onAdvancedFilterChange && renderMobileSection('advanced', <SlidersHorizontal size={18} />, 'Filtros Avançados', undefined,
                  <div className="p-4">
                    <AdvancedFilters properties={properties} onClose={() => setMobileOpenSection(null)} onFilterChange={onAdvancedFilterChange} hideApplyButton />
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 p-4 z-10">
                <button onClick={handleSearch} className="w-full bg-black dark:bg-white text-white dark:text-black px-6 py-4 rounded-2xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 font-medium">
                  <Search size={20} />
                  <span>{resultCount !== undefined ? `Ver ${resultCount} imóveis` : 'Aplicar Filtros'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ──────────────── DESKTOP ──────────────── */}
        <div className="hidden md:flex items-stretch relative">
          {/* Buy / Rent */}
          <div className="flex border-r border-gray-200 dark:border-gray-700">
            <button onClick={() => { setActiveTab('buy'); setPriceMin(''); setPriceMax(''); }} className={`px-6 py-4 transition-colors rounded-tl-2xl rounded-bl-2xl ${activeTab === 'buy' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              Comprar
            </button>
            <button onClick={() => { setActiveTab('rent'); setPriceMin(''); setPriceMax(''); }} className={`px-6 py-4 transition-colors ${activeTab === 'rent' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              Arrendar
            </button>
          </div>

          {/* Tipo — popup */}
          <div className="relative flex items-center gap-2 px-4 py-3 border-r border-gray-200 dark:border-gray-700 flex-1 cursor-pointer" onClick={() => toggleDropdown('type')}>
            <Home size={18} className="text-gray-400 dark:text-gray-300" />
            <span className="text-sm truncate">{propertyType || 'Tipo'}</span>
            <ChevronDown size={14} className="text-gray-400 ml-auto flex-shrink-0" />
            {openDropdown === 'type' && <DesktopDropdown>{renderTypeList()}</DesktopDropdown>}
          </div>

          {/* Tipologia — multi-select popup */}
          <div className="relative flex items-center gap-2 px-4 py-3 border-r border-gray-200 dark:border-gray-700 flex-1 cursor-pointer" onClick={() => toggleDropdown('typology')}>
            <Building size={18} className="text-gray-400 dark:text-gray-300" />
            <span className="text-sm truncate">{selectedTypologies.length > 0 ? `${selectedTypologies.length} tipologia(s)` : 'Tipologia'}</span>
            <ChevronDown size={14} className="text-gray-400 ml-auto flex-shrink-0" />
            {openDropdown === 'typology' && <DesktopDropdown>{renderTypologyList('max-h-52')}</DesktopDropdown>}
          </div>

          {/* Preço — popup */}
          <div className="relative flex items-center gap-2 px-4 py-3 border-r border-gray-200 dark:border-gray-700 flex-1 cursor-pointer" onClick={() => toggleDropdown('price')}>
            <Euro size={18} className="text-gray-400 dark:text-gray-300" />
            <span className="text-sm truncate">{hasPriceFilter ? getPriceLabel() : 'Preço'}</span>
            <ChevronDown size={14} className="text-gray-400 ml-auto flex-shrink-0" />
            {openDropdown === 'price' && <DesktopDropdown>{renderPriceList()}</DesktopDropdown>}
          </div>

          {/* Zona — searchable multi-select popup */}
          <div className="relative flex items-center gap-2 px-4 py-3 border-r border-gray-200 dark:border-gray-700 flex-1 cursor-pointer" onClick={() => toggleDropdown('location')}>
            <MapPin size={18} className="text-gray-400 dark:text-gray-300" />
            <span className="text-sm truncate">{selectedLocations.length > 0 ? `${selectedLocations.length} zona(s)` : 'Zona'}</span>
            <ChevronDown size={14} className="text-gray-400 ml-auto flex-shrink-0" />
            {openDropdown === 'location' && <DesktopDropdown>{renderLocationList('max-h-52')}</DesktopDropdown>}
          </div>

          {/* Map Button (desktop) */}
          {showMapButton && onMapClick && (
            <button onClick={onMapClick} className="bg-white dark:bg-gray-800 px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 border-r border-gray-200 dark:border-gray-700" aria-label="Ver no mapa">
              <MapIcon size={18} className="text-gray-600 dark:text-gray-300" />
              <span className="text-sm text-gray-600 dark:text-gray-300">Mapa</span>
            </button>
          )}

          {/* Advanced Filters */}
          {onAdvancedFilterChange && (
            <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="bg-white dark:bg-gray-800 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 border-r border-gray-200 dark:border-gray-700" aria-label="Filtros Avançados">
              <SlidersHorizontal size={18} className="text-gray-600 dark:text-gray-300" />
              <span className="text-sm text-gray-600 dark:text-gray-300">Mais</span>
              <ChevronDown size={16} className={`text-gray-600 dark:text-gray-300 transition-transform duration-200 ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>
          )}

          {/* Search */}
          <button onClick={handleSearch} className="bg-black dark:bg-white text-white dark:text-black px-6 py-4 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 rounded-r-2xl">
            <Search size={20} />
          </button>
        </div>
      </div>

      {/* ──────── ACTIVE FILTER CHIPS + RESULT COUNT ──────── */}
      {(hasActiveFilters || resultCount !== undefined) && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {resultCount !== undefined && (
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
              {resultCount} {resultCount === 1 ? 'imóvel' : 'imóveis'}
            </span>
          )}

          {selectedLocations.map(loc => (
            <button key={loc} onClick={() => toggleLocation(loc)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <MapPin size={12} /><span>{loc}</span><X size={12} />
            </button>
          ))}

          {propertyType && (
            <button onClick={() => setPropertyType('')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <Home size={12} /><span>{propertyType}</span><X size={12} />
            </button>
          )}

          {selectedTypologies.map(typ => (
            <button key={typ} onClick={() => toggleTypology(typ)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <Building size={12} /><span>{typ}</span><X size={12} />
            </button>
          ))}

          {hasPriceFilter && (
            <button onClick={() => { setPriceMin(''); setPriceMax(''); }} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <Euro size={12} /><span>{getPriceLabel()}</span><X size={12} />
            </button>
          )}

          {hasActiveFilters && (
            <button onClick={clearAllFilters} className="text-xs text-gray-500 hover:text-black dark:hover:text-white transition-colors underline ml-1">
              Limpar tudo
            </button>
          )}
        </div>
      )}

      {/* ──────── ADVANCED FILTERS PANEL (desktop) ──────── */}
      {onAdvancedFilterChange && showAdvancedFilters && (
        <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 relative">
          <AdvancedFilters properties={properties} onClose={() => setShowAdvancedFilters(false)} onFilterChange={onAdvancedFilterChange} />
        </div>
      )}
    </div>
  );
}
