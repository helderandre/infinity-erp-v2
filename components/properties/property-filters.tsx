'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Search, X, PlusCircle, Check } from 'lucide-react'
import {
  PROPERTY_STATUS,
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

interface PropertyFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  selectedStatuses: string[]
  onStatusesChange: (value: string[]) => void
  propertyType: string
  onPropertyTypeChange: (value: string) => void
  businessType: string
  onBusinessTypeChange: (value: string) => void
  condition: string
  onConditionChange: (value: string) => void
  consultants: { id: string; commercial_name: string }[]
  consultantId: string
  onConsultantChange: (value: string) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

const allStatusKeys = Object.keys(PROPERTY_STATUS)

export function PropertyFilters({
  search,
  onSearchChange,
  selectedStatuses,
  onStatusesChange,
  propertyType,
  onPropertyTypeChange,
  businessType,
  onBusinessTypeChange,
  condition,
  onConditionChange,
  consultants,
  consultantId,
  onConsultantChange,
  onClearFilters,
  hasActiveFilters,
}: PropertyFiltersProps) {
  const toggleStatus = (key: string) => {
    if (selectedStatuses.includes(key)) {
      onStatusesChange(selectedStatuses.filter((s) => s !== key))
    } else {
      onStatusesChange([...selectedStatuses, key])
    }
  }

  const isAllSelected = selectedStatuses.length === allStatusKeys.length
  const hasStatusFilter = selectedStatuses.length > 0 && selectedStatuses.length < allStatusKeys.length

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por título, cidade..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 border-dashed">
            <PlusCircle className="mr-2 h-4 w-4" />
            Estado
            {hasStatusFilter && (
              <>
                <Separator orientation="vertical" className="mx-2 h-4" />
                <div className="flex gap-1">
                  {selectedStatuses.length > 2 ? (
                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                      {selectedStatuses.length} seleccionados
                    </Badge>
                  ) : (
                    selectedStatuses.map((key) => (
                      <Badge
                        key={key}
                        variant="secondary"
                        className="rounded-sm px-1 font-normal"
                      >
                        {PROPERTY_STATUS[key as keyof typeof PROPERTY_STATUS]?.label || key}
                      </Badge>
                    ))
                  )}
                </div>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Estado" />
            <CommandList>
              <CommandEmpty>Sem resultados.</CommandEmpty>
              <CommandGroup>
                {Object.entries(PROPERTY_STATUS).map(([key, config]) => {
                  const isSelected = selectedStatuses.includes(key)
                  return (
                    <CommandItem
                      key={key}
                      onSelect={() => toggleStatus(key)}
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible'
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </div>
                      <span className={cn('mr-2 h-2 w-2 rounded-full shrink-0', config.dot)} />
                      <span>{config.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              {hasStatusFilter && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => onStatusesChange([])}
                      className="justify-center text-center"
                    >
                      Limpar filtros
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Select value={propertyType} onValueChange={onPropertyTypeChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          {Object.entries(PROPERTY_TYPES).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={businessType} onValueChange={onBusinessTypeChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Negócio" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {Object.entries(BUSINESS_TYPES).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={condition} onValueChange={onConditionChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Condição" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as condições</SelectItem>
          {Object.entries(PROPERTY_CONDITIONS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {consultants.length > 0 && (
        <Select value={consultantId} onValueChange={onConsultantChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Consultor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os consultores</SelectItem>
            {consultants.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.commercial_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
