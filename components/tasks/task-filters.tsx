'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { TASK_PRIORITY_MAP } from '@/types/task'

interface TaskFiltersProps {
  filters: {
    assigned_to?: string
    priority?: number
    is_completed?: 'true' | 'false'
    overdue?: 'true' | 'false'
    search?: string
  }
  onFiltersChange: (filters: any) => void
  consultants: Array<{ id: string; commercial_name: string }>
  currentUserId?: string
}

export function TaskFilters({ filters, onFiltersChange, consultants, currentUserId }: TaskFiltersProps) {
  const hasFilters = filters.assigned_to || filters.priority || filters.is_completed || filters.overdue || filters.search

  const clearFilters = () => {
    onFiltersChange({})
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar tarefas..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
          className="pl-8 h-9"
        />
      </div>

      {/* Assignee */}
      <Select
        value={filters.assigned_to || '_all'}
        onValueChange={(v) => onFiltersChange({ ...filters, assigned_to: v === '_all' ? undefined : v })}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Atribuído a" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos</SelectItem>
          {currentUserId && (
            <SelectItem value={currentUserId}>As minhas</SelectItem>
          )}
          {consultants.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.commercial_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority */}
      <Select
        value={filters.priority ? String(filters.priority) : '_all'}
        onValueChange={(v) => onFiltersChange({ ...filters, priority: v === '_all' ? undefined : Number(v) })}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todas</SelectItem>
          {Object.entries(TASK_PRIORITY_MAP).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${v.dot}`} />
                {v.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status */}
      <Select
        value={filters.is_completed || (filters.overdue === 'true' ? '_overdue' : '_pending')}
        onValueChange={(v) => {
          if (v === '_overdue') {
            onFiltersChange({ ...filters, is_completed: undefined, overdue: 'true' })
          } else if (v === '_all') {
            onFiltersChange({ ...filters, is_completed: undefined, overdue: undefined })
          } else {
            onFiltersChange({ ...filters, is_completed: v as 'true' | 'false', overdue: undefined })
          }
        }}
      >
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="false">Pendentes</SelectItem>
          <SelectItem value="true">Concluídas</SelectItem>
          <SelectItem value="_overdue">Em atraso</SelectItem>
          <SelectItem value="_all">Todas</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1">
          <X className="h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  )
}
