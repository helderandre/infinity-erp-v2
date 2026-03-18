'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import { CREDIT_STATUS_COLORS } from '@/lib/constants'
import { MultiSelectFilter } from '@/components/shared/multi-select-filter'

interface CreditFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  consultants: { id: string; commercial_name: string }[]
  onClearFilters: () => void
  hasActiveFilters: boolean
  // Multi-select (optional)
  selectedStatuses?: string[]
  onStatusesChange?: (value: string[]) => void
  selectedAssigned?: string[]
  onAssignedChange?: (value: string[]) => void
  // Single-select (backward compat)
  status?: string
  onStatusChange?: (value: string) => void
  assignedTo?: string
  onAssignedToChange?: (value: string) => void
}

const statusOptions = Object.entries(CREDIT_STATUS_COLORS).map(([key, config]) => ({
  value: key,
  label: config.label,
  dot: config.dot,
}))

export function CreditFilters({
  search,
  onSearchChange,
  selectedStatuses = [],
  onStatusesChange,
  selectedAssigned = [],
  onAssignedChange,
  consultants,
  onClearFilters,
  hasActiveFilters,
  status,
  onStatusChange,
  assignedTo,
  onAssignedToChange,
}: CreditFiltersProps) {
  const handleStatuses = onStatusesChange || ((vals: string[]) => onStatusChange?.(vals[0] || 'all'))
  const handleAssigned = onAssignedChange || ((vals: string[]) => onAssignedToChange?.(vals[0] || 'all'))

  const effectiveStatuses = onStatusesChange ? selectedStatuses : (status && status !== 'all' ? [status] : [])
  const effectiveAssigned = onAssignedChange ? selectedAssigned : (assignedTo && assignedTo !== 'all' ? [assignedTo] : [])

  const consultantOptions = consultants.map((c) => ({
    value: c.id,
    label: c.commercial_name,
  }))

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome ou referência..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <MultiSelectFilter
        title="Estado"
        options={statusOptions}
        selected={effectiveStatuses}
        onSelectedChange={handleStatuses}
      />

      {consultants.length > 0 && (
        <MultiSelectFilter
          title="Responsável"
          options={consultantOptions}
          selected={effectiveAssigned}
          onSelectedChange={handleAssigned}
          searchable
        />
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="mr-1 h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  )
}
