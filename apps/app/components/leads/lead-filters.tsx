'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Search, X, CalendarDays } from 'lucide-react'
import {
  LEAD_ESTADOS,
  LEAD_TEMPERATURAS,
  LEAD_ORIGENS,
} from '@/lib/constants'
import { MultiSelectFilter } from '@/components/shared/multi-select-filter'
import { MobileFilterSheet } from '@/components/shared/mobile-filter-sheet'

/** Filtro de intervalo de datas (data de chegada do contacto). */
function DateRangeFilter({
  from, to, onChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const active = !!(from || to)
  const label = from && to ? `${from} → ${to}` : from ? `Desde ${from}` : to ? `Até ${to}` : null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <CalendarDays className="mr-2 h-4 w-4" />
          Data
          {active && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal text-[11px]">
                {label}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Data de chegada</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-8">De</span>
            <Input type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className="h-9 rounded-lg text-xs" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-8">Até</span>
            <Input type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className="h-9 rounded-lg text-xs" />
          </div>
        </div>
        {active && (
          <Button type="button" variant="ghost" size="sm" className="w-full text-[11px] h-7" onClick={() => onChange('', '')}>
            Limpar datas
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

interface LeadFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  consultants: { id: string; commercial_name: string }[]
  onClearFilters: () => void
  hasActiveFilters: boolean
  /** Esconde o filtro "Consultor" — usar para a vista do consultor (que
   *  só vê os seus contactos, logo o filtro é redundante). */
  hideConsultantFilter?: boolean
  // Multi-select (optional — use these for new pages)
  selectedEstados?: string[]
  onEstadosChange?: (value: string[]) => void
  selectedTemperaturas?: string[]
  onTemperaturasChange?: (value: string[]) => void
  selectedOrigens?: string[]
  onOrigensChange?: (value: string[]) => void
  selectedAgents?: string[]
  onAgentsChange?: (value: string[]) => void
  /** Filtro de qualificação por tipo de negócio (Compra/Venda/Arrendatário/Arrendador). */
  selectedQualifs?: string[]
  onQualifsChange?: (value: string[]) => void
  /** Filtro pela data de chegada do contacto (created_at). */
  dateFrom?: string
  dateTo?: string
  onDateRangeChange?: (from: string, to: string) => void
  // Single-select (backward compat)
  estado?: string
  onEstadoChange?: (value: string) => void
  temperatura?: string
  onTemperaturaChange?: (value: string) => void
  origem?: string
  onOrigemChange?: (value: string) => void
  agentId?: string
  onAgentChange?: (value: string) => void
}

const estadoOptions = LEAD_ESTADOS.map((e) => ({ value: e, label: e }))
const temperaturaOptions = LEAD_TEMPERATURAS.map((t) => ({ value: t.value, label: t.label, color: t.color?.split(' ')[0] }))
const origemOptions = LEAD_ORIGENS.map((o) => ({ value: o, label: o }))

// Qualificação = tipo do negocio associado. Etiquetas curtas (QC/QV/QA-P/QA-A)
// ficam no badge do contacto; aqui mostramos labels descritivas.
const qualifOptions: { value: string; label: string }[] = [
  { value: 'Compra', label: 'QC · Comprador' },
  { value: 'Venda', label: 'QV · Vendedor' },
  { value: 'Arrendatário', label: 'QA-P · Arrendatário' },
  { value: 'Arrendador', label: 'QA-A · Senhorio' },
]

export function LeadFilters({
  search,
  onSearchChange,
  selectedEstados = [],
  onEstadosChange,
  selectedTemperaturas = [],
  onTemperaturasChange,
  selectedOrigens = [],
  onOrigensChange,
  selectedAgents = [],
  onAgentsChange,
  selectedQualifs = [],
  onQualifsChange,
  dateFrom = '',
  dateTo = '',
  onDateRangeChange,
  consultants,
  onClearFilters,
  hasActiveFilters,
  hideConsultantFilter,
  // Backward compat
  estado,
  onEstadoChange,
  temperatura,
  onTemperaturaChange,
  origem,
  onOrigemChange,
  agentId,
  onAgentChange,
}: LeadFiltersProps) {
  const handleEstados = onEstadosChange || ((vals: string[]) => onEstadoChange?.(vals[0] || 'all'))
  const handleTemps = onTemperaturasChange || ((vals: string[]) => onTemperaturaChange?.(vals[0] || 'all'))
  const handleOrigens = onOrigensChange || ((vals: string[]) => onOrigemChange?.(vals[0] || 'all'))
  const handleAgents = onAgentsChange || ((vals: string[]) => onAgentChange?.(vals[0] || 'all'))
  const handleQualifs = onQualifsChange || (() => {})

  const effectiveEstados = onEstadosChange ? selectedEstados : (estado && estado !== 'all' ? [estado] : [])
  const effectiveTemps = onTemperaturasChange ? selectedTemperaturas : (temperatura && temperatura !== 'all' ? [temperatura] : [])
  const effectiveOrigens = onOrigensChange ? selectedOrigens : (origem && origem !== 'all' ? [origem] : [])
  const effectiveAgents = onAgentsChange ? selectedAgents : (agentId && agentId !== 'all' ? [agentId] : [])

  const consultantOptions = consultants.map((c) => ({
    value: c.id,
    label: c.commercial_name,
  }))

  const showConsultantFilter = !hideConsultantFilter && consultants.length > 0
  const activeFilterCount =
    effectiveEstados.length + effectiveTemps.length + effectiveOrigens.length +
    effectiveAgents.length + selectedQualifs.length + (dateFrom || dateTo ? 1 : 0)

  const filterButtons = (
    <>
      <MultiSelectFilter title="Estado" options={estadoOptions} selected={effectiveEstados} onSelectedChange={handleEstados} />
      <MultiSelectFilter title="Temperatura" options={temperaturaOptions} selected={effectiveTemps} onSelectedChange={handleTemps} />
      {onQualifsChange && (
        <MultiSelectFilter title="Qualificação" options={qualifOptions} selected={selectedQualifs} onSelectedChange={handleQualifs} />
      )}
      <MultiSelectFilter title="Fonte" options={origemOptions} selected={effectiveOrigens} onSelectedChange={handleOrigens} />
      {onDateRangeChange && (
        <DateRangeFilter from={dateFrom} to={dateTo} onChange={onDateRangeChange} />
      )}
      {showConsultantFilter && (
        <MultiSelectFilter title="Consultor" options={consultantOptions} selected={effectiveAgents} onSelectedChange={handleAgents} searchable />
      )}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="rounded-full">
          <X className="mr-1 h-4 w-4" />
          Limpar
        </Button>
      )}
    </>
  )

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome, email ou telefone..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 rounded-full"
        />
        {search && (
          <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <MobileFilterSheet activeCount={activeFilterCount}>
        {filterButtons}
      </MobileFilterSheet>
    </div>
  )
}
