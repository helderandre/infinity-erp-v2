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
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome ou email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="active">Activos</SelectItem>
          <SelectItem value="inactive">Inactivos</SelectItem>
        </SelectContent>
      </Select>

      <Select value={role} onValueChange={onRoleChange}>
        <SelectTrigger className="w-[180px]">
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
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-9 px-2">
          <X className="mr-1 h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  )
}
