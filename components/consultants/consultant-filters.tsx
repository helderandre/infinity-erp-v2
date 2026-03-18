'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'

interface ConsultantFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  role: string
  onRoleChange: (value: string) => void
  roles: { id: string; name: string }[]
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function ConsultantFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  role,
  onRoleChange,
  roles,
  onClearFilters,
  hasActiveFilters,
}: ConsultantFiltersProps) {
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

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="h-9 w-[130px] text-sm rounded-full bg-muted/50 border-0">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="active">Activos</SelectItem>
          <SelectItem value="inactive">Inactivos</SelectItem>
        </SelectContent>
      </Select>

      <Select value={role} onValueChange={onRoleChange}>
        <SelectTrigger className="h-9 w-[170px] text-sm rounded-full bg-muted/50 border-0">
          <SelectValue placeholder="Função" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as funções</SelectItem>
          {roles.map((r) => (
            <SelectItem key={r.id} value={r.name}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-8 px-2 rounded-full text-xs">
          <X className="mr-1 h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  )
}
