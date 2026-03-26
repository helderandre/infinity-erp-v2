'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import { MultiSelectFilter } from '@/components/shared/multi-select-filter'

interface ConsultantFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  roles: { id: string; name: string }[]
  onClearFilters: () => void
  hasActiveFilters: boolean
  // Multi-select (optional)
  selectedStatuses?: string[]
  onStatusesChange?: (value: string[]) => void
  selectedRoles?: string[]
  onRolesChange?: (value: string[]) => void
  // Single-select (backward compat)
  status?: string
  onStatusChange?: (value: string) => void
  role?: string
  onRoleChange?: (value: string) => void
}

const statusOptions = [
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
]

export function ConsultantFilters({
  search,
  onSearchChange,
  selectedStatuses = [],
  onStatusesChange,
  selectedRoles = [],
  onRolesChange,
  roles,
  onClearFilters,
  hasActiveFilters,
  status,
  onStatusChange,
  role,
  onRoleChange,
}: ConsultantFiltersProps) {
  const handleStatuses = onStatusesChange || ((vals: string[]) => onStatusChange?.(vals[0] || 'all'))
  const handleRoles = onRolesChange || ((vals: string[]) => onRoleChange?.(vals[0] || 'all'))

  const effectiveStatuses = onStatusesChange ? selectedStatuses : (status && status !== 'all' ? [status] : [])
  const effectiveRoles = onRolesChange ? selectedRoles : (role && role !== 'all' ? [role] : [])

  const roleOptions = roles.map((r) => ({ value: r.name, label: r.name }))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Pesquisar consultor..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 rounded-full bg-muted/50 border-0 text-sm"
        />
      </div>

      <MultiSelectFilter
        title="Estado"
        options={statusOptions}
        selected={effectiveStatuses}
        onSelectedChange={handleStatuses}
      />

      {roles.length > 0 && (
        <MultiSelectFilter
          title="Função"
          options={roleOptions}
          selected={effectiveRoles}
          onSelectedChange={handleRoles}
          searchable
        />
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-8 px-2 rounded-full text-xs">
          <X className="mr-1 h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  )
}
