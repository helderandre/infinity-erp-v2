'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import {
  LEAD_ESTADOS,
  LEAD_TEMPERATURAS,
  LEAD_ORIGENS,
} from '@/lib/constants'
import { MultiSelectFilter } from '@/components/shared/multi-select-filter'
import { MobileFilterSheet } from '@/components/shared/mobile-filter-sheet'

interface LeadFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  consultants: { id: string; commercial_name: string }[]
  onClearFilters: () => void
  hasActiveFilters: boolean
  // Multi-select (optional — use these for new pages)
  selectedEstados?: string[]
  onEstadosChange?: (value: string[]) => void
  selectedTemperaturas?: string[]
  onTemperaturasChange?: (value: string[]) => void
  selectedOrigens?: string[]
  onOrigensChange?: (value: string[]) => void
  selectedAgents?: string[]
  onAgentsChange?: (value: string[]) => void
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
  consultants,
  onClearFilters,
  hasActiveFilters,
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

  const effectiveEstados = onEstadosChange ? selectedEstados : (estado && estado !== 'all' ? [estado] : [])
  const effectiveTemps = onTemperaturasChange ? selectedTemperaturas : (temperatura && temperatura !== 'all' ? [temperatura] : [])
  const effectiveOrigens = onOrigensChange ? selectedOrigens : (origem && origem !== 'all' ? [origem] : [])
  const effectiveAgents = onAgentsChange ? selectedAgents : (agentId && agentId !== 'all' ? [agentId] : [])

  const consultantOptions = consultants.map((c) => ({
    value: c.id,
    label: c.commercial_name,
  }))

  const activeFilterCount = effectiveEstados.length + effectiveTemps.length + effectiveOrigens.length + effectiveAgents.length

  const filterButtons = (
    <>
      <MultiSelectFilter title="Estado" options={estadoOptions} selected={effectiveEstados} onSelectedChange={handleEstados} />
      <MultiSelectFilter title="Temperatura" options={temperaturaOptions} selected={effectiveTemps} onSelectedChange={handleTemps} />
      <MultiSelectFilter title="Origem" options={origemOptions} selected={effectiveOrigens} onSelectedChange={handleOrigens} />
      {consultants.length > 0 && (
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
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome..."
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
