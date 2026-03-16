'use client'

import { VISIT_STATUS_OPTIONS } from '@/lib/constants'
import { Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { VisitFilters } from '@/types/visit'

interface VisitFiltersBarProps {
  filters: VisitFilters
  onFiltersChange: (filters: VisitFilters) => void
  consultants?: Array<{ id: string; commercial_name: string | null }>
}

export function VisitFiltersBar({
  filters,
  onFiltersChange,
  consultants = [],
}: VisitFiltersBarProps) {
  const hasActiveFilters = !!(
    filters.status ||
    filters.consultant_id ||
    filters.date_from ||
    filters.date_to ||
    filters.search
  )

  const updateFilter = (key: keyof VisitFilters, value: string | undefined) => {
    onFiltersChange({ ...filters, [key]: value || undefined })
  }

  const clearFilters = () => {
    onFiltersChange({})
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar visitas..."
          className="pl-9"
          value={filters.search || ''}
          onChange={(e) => updateFilter('search', e.target.value)}
        />
      </div>

      {/* Status */}
      <Select
        value={filters.status || '_all'}
        onValueChange={(v) => updateFilter('status', v === '_all' ? undefined : v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos os estados</SelectItem>
          {VISIT_STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Consultant */}
      {consultants.length > 0 && (
        <Select
          value={filters.consultant_id || '_all'}
          onValueChange={(v) => updateFilter('consultant_id', v === '_all' ? undefined : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Consultor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos os consultores</SelectItem>
            {consultants.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.commercial_name || c.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Date range */}
      <Input
        type="date"
        className="w-[150px]"
        value={filters.date_from || ''}
        onChange={(e) => updateFilter('date_from', e.target.value)}
        placeholder="De"
      />
      <Input
        type="date"
        className="w-[150px]"
        value={filters.date_to || ''}
        onChange={(e) => updateFilter('date_to', e.target.value)}
        placeholder="Até"
      />

      {/* Clear */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  )
}
