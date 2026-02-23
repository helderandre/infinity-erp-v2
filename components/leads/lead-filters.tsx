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
import { Search, X } from 'lucide-react'
import {
  LEAD_ESTADOS,
  LEAD_TEMPERATURAS,
  LEAD_ORIGENS,
} from '@/lib/constants'

interface LeadFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  estado: string
  onEstadoChange: (value: string) => void
  temperatura: string
  onTemperaturaChange: (value: string) => void
  origem: string
  onOrigemChange: (value: string) => void
  consultants: { id: string; commercial_name: string }[]
  agentId: string
  onAgentChange: (value: string) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function LeadFilters({
  search,
  onSearchChange,
  estado,
  onEstadoChange,
  temperatura,
  onTemperaturaChange,
  origem,
  onOrigemChange,
  consultants,
  agentId,
  onAgentChange,
  onClearFilters,
  hasActiveFilters,
}: LeadFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={estado} onValueChange={onEstadoChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os estados</SelectItem>
          {LEAD_ESTADOS.map((e) => (
            <SelectItem key={e} value={e}>
              {e}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={temperatura} onValueChange={onTemperaturaChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Temperatura" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {LEAD_TEMPERATURAS.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              <span className={t.color.split(' ')[0]}>{t.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={origem} onValueChange={onOrigemChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as origens</SelectItem>
          {LEAD_ORIGENS.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {consultants.length > 0 && (
        <Select value={agentId} onValueChange={onAgentChange}>
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
