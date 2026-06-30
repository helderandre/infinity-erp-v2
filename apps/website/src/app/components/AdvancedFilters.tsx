"use client";

import { useState, useEffect, useRef } from 'react';
import { X, Check, Search, ChevronDown, Hash, Ruler, Wrench, Sparkles } from 'lucide-react';

interface AdvancedFiltersProps {
  properties: any[];
  onClose: () => void;
  onFilterChange: (filters: {
    sizeMin?: number;
    sizeMax?: number;
    condition: string[];
    extras: string[];
    referenceId?: string;
  }) => void;
  hideApplyButton?: boolean;
}

// Convert DB condition names like "nova_construcao" or "para_recuperar" to presentable names
function formatConditionName(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bDe\b/g, 'de')
    .replace(/\bDo\b/g, 'do')
    .replace(/\bDa\b/g, 'da')
    .replace(/\bDos\b/g, 'dos')
    .replace(/\bDas\b/g, 'das')
    .replace(/\bE\b/g, 'e')
    .replace(/\bEm\b/g, 'em')
    .replace(/\bCom\b/g, 'com')
    .replace(/^./, c => c.toUpperCase());
}

export function AdvancedFilters({ properties, onClose, onFilterChange, hideApplyButton = false }: AdvancedFiltersProps) {
  const [sizeMin, setSizeMin] = useState<string>('');
  const [sizeMax, setSizeMax] = useState<string>('');
  const [referenceId, setReferenceId] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [extrasSearch, setExtrasSearch] = useState('');
  const [openSection, setOpenSection] = useState<string | null>(null);

  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;

  // Extract unique extras from database
  const allExtras = Array.from(
    new Set(
      properties
        .flatMap(p => {
          const extras = p.extras || p.equipment || '';
          if (!extras) return [];
          if (typeof extras === 'string') {
            return extras.split(/[,;|\n]/).map((e: string) => e.trim()).filter(Boolean);
          } else if (Array.isArray(extras)) {
            return extras;
          }
          return [];
        })
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-PT'));

  const normalizeText = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filteredExtras = extrasSearch
    ? allExtras.filter(e => normalizeText(e).includes(normalizeText(extrasSearch)))
    : allExtras;

  // Extract unique conditions from database (raw values)
  const dbConditionsRaw = Array.from(
    new Set(
      properties
        .map(p => p.property_condition || p.building_condition)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-PT'));

  const conditionOptions: { value: string; label: string }[] = dbConditionsRaw.length > 0
    ? dbConditionsRaw.map(raw => ({ value: raw, label: formatConditionName(raw) }))
    : [
        { value: 'Nova construção', label: 'Nova Construção' },
        { value: 'Bom estado', label: 'Bom Estado' },
        { value: 'Para recuperar', label: 'Para Recuperar' },
      ];

  useEffect(() => {
    onFilterChangeRef.current({
      sizeMin: sizeMin ? Number(sizeMin) : undefined,
      sizeMax: sizeMax ? Number(sizeMax) : undefined,
      condition: selectedCondition,
      extras: selectedExtras,
      referenceId: referenceId || undefined,
    });
  }, [sizeMin, sizeMax, referenceId, selectedCondition, selectedExtras]);

  const toggleItem = (item: string, list: string[], setter: (val: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const clearAllFilters = () => {
    setSizeMin('');
    setSizeMax('');
    setReferenceId('');
    setSelectedCondition([]);
    setSelectedExtras([]);
    setExtrasSearch('');
  };

  const activeFiltersCount =
    (sizeMin ? 1 : 0) +
    (sizeMax ? 1 : 0) +
    (referenceId ? 1 : 0) +
    selectedCondition.length +
    selectedExtras.length;

  // Modern select item (same style as main search bar)
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

  // Size options for modern picker
  const sizeOptions = [
    { value: '', label: 'Qualquer' },
    { value: '50', label: '50 m²' },
    { value: '75', label: '75 m²' },
    { value: '100', label: '100 m²' },
    { value: '150', label: '150 m²' },
    { value: '200', label: '200 m²' },
    { value: '300', label: '300 m²' },
    { value: '500', label: '500 m²' },
  ];

  // Collapsible section helper (inline, not a component — avoids remount on state change)
  const renderSection = (id: string, icon: React.ReactNode, label: string, summary: string | undefined, content: React.ReactNode) => {
    const isOpen = openSection === id;
    return (
      <div key={id} className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
        <button
          onClick={() => setOpenSection(isOpen ? null : id)}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-gray-400">{icon}</span>
            <span className="text-sm font-medium">{label}</span>
            {summary && !isOpen && <span className="text-xs text-gray-400 truncate max-w-[160px]">{summary}</span>}
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

  // Size summary
  const sizeSummary = sizeMin && sizeMax ? `${sizeMin} - ${sizeMax} m²`
    : sizeMin ? `Desde ${sizeMin} m²`
    : sizeMax ? `Até ${sizeMax} m²`
    : undefined;

  // Condition summary
  const conditionSummary = selectedCondition.length > 0
    ? selectedCondition.map(c => conditionOptions.find(o => o.value === c)?.label || c).join(', ')
    : undefined;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Filtros Avançados</h3>
          {activeFiltersCount > 0 && (
            <span className="w-6 h-6 bg-black dark:bg-white text-white dark:text-black text-xs rounded-full flex items-center justify-center font-medium">
              {activeFiltersCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button onClick={clearAllFilters} className="text-sm text-gray-500 hover:text-black dark:hover:text-white transition-colors">
              Limpar tudo
            </button>
          )}
          <button onClick={onClose} aria-label="Fechar filtros" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Collapsible Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Reference ID */}
        {renderSection('reference', <Hash size={18} />, 'Referência', referenceId || undefined,
          <div className="p-3">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                aria-label="Pesquisar por referência"
                value={referenceId}
                onChange={e => setReferenceId(e.target.value)}
                placeholder="Pesquisar por ID"
                className="w-full bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400"
              />
              {referenceId && (
                <button onClick={() => setReferenceId('')} aria-label="Limpar referência" className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Size */}
        {renderSection('size', <Ruler size={18} />, 'Tamanho (m²)', sizeSummary,
          <div className="p-3 space-y-2">
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-400 font-medium">Mínimo</span>
              </div>
              <div className="max-h-36 overflow-y-auto py-1">
                {sizeOptions.map(opt => (
                  <SelectItem key={`min-${opt.value}`} label={opt.label} selected={sizeMin === opt.value} onClick={() => setSizeMin(opt.value)} />
                ))}
              </div>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-400 font-medium">Máximo</span>
              </div>
              <div className="max-h-36 overflow-y-auto py-1">
                {sizeOptions.map(opt => (
                  <SelectItem key={`max-${opt.value}`} label={opt.label} selected={sizeMax === opt.value} onClick={() => setSizeMax(opt.value)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Condition */}
        {renderSection('condition', <Wrench size={18} />, 'Estado', conditionSummary,
          <>
            {selectedCondition.length > 0 && (
              <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5">
                {selectedCondition.map(cond => {
                  const condLabel = conditionOptions.find(o => o.value === cond)?.label || cond;
                  return (
                    <button key={cond} onClick={() => toggleItem(cond, selectedCondition, setSelectedCondition)} className="flex items-center gap-1 px-2.5 py-1 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-medium hover:opacity-80 transition-opacity">
                      {condLabel}
                      <X size={11} />
                    </button>
                  );
                })}
              </div>
            )}
            <div className="py-1">
              {conditionOptions.map(({ value, label }) => (
                <SelectItem key={value} label={label} selected={selectedCondition.includes(value)} onClick={() => toggleItem(value, selectedCondition, setSelectedCondition)} />
              ))}
            </div>
          </>
        )}

        {/* Extras */}
        {allExtras.length > 0 && renderSection('extras', <Sparkles size={18} />, 'Mais filtros', selectedExtras.length > 0 ? `${selectedExtras.length} selecionado(s)` : undefined,
          <>
            {/* Search */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input type="text" value={extrasSearch} onChange={e => setExtrasSearch(e.target.value)} placeholder="Pesquisar..." className="w-full bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400" />
                {extrasSearch && <button onClick={() => setExtrasSearch('')} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={14} /></button>}
              </div>
            </div>
            {/* Selected pills */}
            {selectedExtras.length > 0 && (
              <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5">
                {selectedExtras.map(extra => (
                  <button key={extra} onClick={() => toggleItem(extra, selectedExtras, setSelectedExtras)} className="flex items-center gap-1 px-2.5 py-1 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-medium hover:opacity-80 transition-opacity">
                    {extra}
                    <X size={11} />
                  </button>
                ))}
              </div>
            )}
            {/* Options */}
            <div className="max-h-48 overflow-y-auto py-1">
              {filteredExtras.length > 0 ? filteredExtras.map(extra => (
                <SelectItem key={extra} label={extra} selected={selectedExtras.includes(extra)} onClick={() => toggleItem(extra, selectedExtras, setSelectedExtras)} />
              )) : <p className="px-4 py-3 text-sm text-gray-400">Nenhum resultado</p>}
            </div>
            {selectedExtras.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 p-2">
                <button onClick={() => setSelectedExtras([])} className="w-full text-sm text-gray-500 hover:text-black dark:hover:text-white py-1.5 transition-colors">Limpar seleção</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Apply Button */}
      {!hideApplyButton && (
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={onClose} className="w-full bg-black dark:bg-white text-white dark:text-black py-3.5 rounded-2xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium">
            Aplicar Filtros
          </button>
        </div>
      )}
    </>
  );
}
