'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import {
  PROPERTY_STATUS,
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
} from '@/lib/constants'
import { MultiSelectFilter } from '@/components/shared/multi-select-filter'
import { MobileFilterSheet } from '@/components/shared/mobile-filter-sheet'

interface PropertyFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  selectedStatuses: string[]
  onStatusesChange: (value: string[]) => void
  consultants: { id: string; commercial_name: string }[]
  onClearFilters: () => void
  hasActiveFilters: boolean
  /** Optional element rendered before the filter button on mobile */
  mobilePrefix?: React.ReactNode
  // Multi-select (optional)
  selectedPropertyTypes?: string[]
  onPropertyTypesChange?: (value: string[]) => void
  selectedBusinessTypes?: string[]
  onBusinessTypesChange?: (value: string[]) => void
  selectedConditions?: string[]
  onConditionsChange?: (value: string[]) => void
  selectedConsultants?: string[]
  onConsultantsChange?: (value: string[]) => void
  // Single-select (backward compat)
  propertyType?: string
  onPropertyTypeChange?: (value: string) => void
  businessType?: string
  onBusinessTypeChange?: (value: string) => void
  condition?: string
  onConditionChange?: (value: string) => void
  consultantId?: string
  onConsultantChange?: (value: string) => void
}

const statusOptions = Object.entries(PROPERTY_STATUS).map(([key, config]) => ({
  value: key,
  label: config.label,
  dot: config.dot,
}))

const typeOptions = Object.entries(PROPERTY_TYPES).map(([key, label]) => ({
  value: key,
  label: label as string,
}))

const businessOptions = Object.entries(BUSINESS_TYPES).map(([key, label]) => ({
  value: key,
  label: label as string,
}))

const conditionOptions = Object.entries(PROPERTY_CONDITIONS).map(([key, label]) => ({
  value: key,
  label: label as string,
}))

export function PropertyFilters({
  search,
  onSearchChange,
  selectedStatuses,
  onStatusesChange,
  selectedPropertyTypes = [],
  onPropertyTypesChange,
  selectedBusinessTypes = [],
  onBusinessTypesChange,
  selectedConditions = [],
  onConditionsChange,
  consultants,
  selectedConsultants = [],
  onConsultantsChange,
  onClearFilters,
  hasActiveFilters,
  // Backward compat
  propertyType,
  onPropertyTypeChange,
  businessType,
  onBusinessTypeChange,
  condition,
  onConditionChange,
  consultantId,
  onConsultantChange,
  mobilePrefix,
}: PropertyFiltersProps) {
  // Support both multi-select and legacy single-select
  const handleTypesChange = onPropertyTypesChange || ((vals: string[]) => onPropertyTypeChange?.(vals[0] || 'all'))
  const handleBusinessChange = onBusinessTypesChange || ((vals: string[]) => onBusinessTypeChange?.(vals[0] || 'all'))
  const handleConditionsChange = onConditionsChange || ((vals: string[]) => onConditionChange?.(vals[0] || 'all'))
  const handleConsultantsChange = onConsultantsChange || ((vals: string[]) => onConsultantChange?.(vals[0] || 'all'))

  const effectiveTypes = onPropertyTypesChange ? selectedPropertyTypes : (propertyType && propertyType !== 'all' ? [propertyType] : [])
  const effectiveBusiness = onBusinessTypesChange ? selectedBusinessTypes : (businessType && businessType !== 'all' ? [businessType] : [])
  const effectiveConditions = onConditionsChange ? selectedConditions : (condition && condition !== 'all' ? [condition] : [])
  const effectiveConsultants = onConsultantsChange ? selectedConsultants : (consultantId && consultantId !== 'all' ? [consultantId] : [])

  const consultantOptions = consultants.map((c) => ({
    value: c.id,
    label: c.commercial_name,
  }))

  const activeFilterCount = selectedStatuses.length + effectiveTypes.length + effectiveBusiness.length + effectiveConditions.length + effectiveConsultants.length

  const filterButtons = (
    <>
      <MultiSelectFilter
        title="Estado"
        options={statusOptions}
        selected={selectedStatuses}
        onSelectedChange={onStatusesChange}
        searchable
      />

      <MultiSelectFilter
        title="Tipo"
        options={typeOptions}
        selected={effectiveTypes}
        onSelectedChange={handleTypesChange}
      />

      <MultiSelectFilter
        title="Negócio"
        options={businessOptions}
        selected={effectiveBusiness}
        onSelectedChange={handleBusinessChange}
      />

      <MultiSelectFilter
        title="Condição"
        options={conditionOptions}
        selected={effectiveConditions}
        onSelectedChange={handleConditionsChange}
      />

      {consultants.length > 0 && (
        <MultiSelectFilter
          title="Consultor"
          options={consultantOptions}
          selected={effectiveConsultants}
          onSelectedChange={handleConsultantsChange}
          searchable
        />
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
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
          placeholder="Pesquisar por título, cidade..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 rounded-full"
        />
      </div>

      {mobilePrefix}
      <MobileFilterSheet activeCount={activeFilterCount}>
        {filterButtons}
      </MobileFilterSheet>
    </div>
  )
}
