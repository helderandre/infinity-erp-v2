'use client'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import { CREDIT_STATUS_COLORS } from '@/lib/constants'

interface CreditFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  assignedTo: string
  onAssignedToChange: (value: string) => void
  consultants: { id: string; commercial_name: string }[]
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function CreditFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  assignedTo,
  onAssignedToChange,
  consultants,
  onClearFilters,
  hasActiveFilters,
}: CreditFiltersProps) {
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

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os estados</SelectItem>
          {Object.entries(CREDIT_STATUS_COLORS).map(([key, config]) => (
            <SelectItem key={key} value={key}>
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(config.dot, 'h-1.5 w-1.5 rounded-full')}
                  aria-hidden="true"
                />
                {config.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {consultants.length > 0 && (
        <Select value={assignedTo} onValueChange={onAssignedToChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
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
