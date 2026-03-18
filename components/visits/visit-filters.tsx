'use client'

import { VISIT_STATUS_OPTIONS } from '@/lib/constants'
import { Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MultiSelectFilter } from '@/components/shared/multi-select-filter'
import type { VisitFilters } from '@/types/visit'

interface VisitFiltersBarProps {
  filters: VisitFilters
  onFiltersChange: (filters: VisitFilters) => void
  consultants?: Array<{ id: string; commercial_name: string | null }>
}

const statusOptions = VISIT_STATUS_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
}))

export function VisitFiltersBar({
  filters,
  onFiltersChange,
  consultants = [],
}: VisitFiltersBarProps) {
  const hasActiveFilters = !!(
    (filters.statuses && filters.statuses.length > 0) ||
    (filters.consultant_ids && filters.consultant_ids.length > 0) ||
    filters.date_from ||
    filters.date_to ||
    filters.search
  )

  const consultantOptions = consultants
    .filter((c) => c.commercial_name)
    .map((c) => ({
      value: c.id,
      label: c.commercial_name!,
    }))

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar visitas..."
          className="pl-9"
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        />
      </div>

      {/* Status */}
      <MultiSelectFilter
        title="Estado"
        options={statusOptions}
        selected={filters.statuses || []}
        onSelectedChange={(vals) => onFiltersChange({ ...filters, statuses: vals })}
      />

      {/* Consultant */}
      {consultantOptions.length > 0 && (
        <MultiSelectFilter
          title="Consultor"
          options={consultantOptions}
          selected={filters.consultant_ids || []}
          onSelectedChange={(vals) => onFiltersChange({ ...filters, consultant_ids: vals })}
          searchable
        />
      )}

      {/* Date range */}
      <Input
        type="date"
        className="w-[150px]"
        value={filters.date_from || ''}
        onChange={(e) => onFiltersChange({ ...filters, date_from: e.target.value })}
        placeholder="De"
      />
      <Input
        type="date"
        className="w-[150px]"
        value={filters.date_to || ''}
        onChange={(e) => onFiltersChange({ ...filters, date_to: e.target.value })}
        placeholder="Até"
      />

      {/* Clear */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={() => onFiltersChange({})}>
          <X className="mr-1 h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  )
}
