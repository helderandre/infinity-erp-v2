'use client'

import { Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
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
  onNewTask: () => void
  consultants: Array<{ id: string; commercial_name: string }>
  currentUserId?: string
}

export function TaskFilters({ filters, onFiltersChange, onNewTask, consultants, currentUserId }: TaskFiltersProps) {
  const hasFilters = filters.assigned_to || filters.priority || filters.is_completed || filters.overdue

  const activeFilterCount = [
    filters.assigned_to,
    filters.priority,
    filters.is_completed === 'true',
    filters.overdue === 'true',
  ].filter(Boolean).length

  const clearFilters = () => {
    onFiltersChange({ search: filters.search })
  }

  return (
    <div>
      {/* Mobile: search + filter popover + plus */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar tarefas..."
            value={filters.search || ''}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
            className="pl-8 h-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 relative">
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[0.6rem] text-primary-foreground flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filtros</span>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs gap-1">
                  <X className="h-3 w-3" /> Limpar
                </Button>
              )}
            </div>
            <Select value={filters.assigned_to || '_all'} onValueChange={(v) => onFiltersChange({ ...filters, assigned_to: v === '_all' ? undefined : v })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Atribuído a" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {currentUserId && <SelectItem value={currentUserId}>As minhas</SelectItem>}
                {consultants.map((c) => <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.priority ? String(filters.priority) : '_all'} onValueChange={(v) => onFiltersChange({ ...filters, priority: v === '_all' ? undefined : Number(v) })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas</SelectItem>
                {Object.entries(TASK_PRIORITY_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${v.dot}`} />{v.label}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.is_completed || (filters.overdue === 'true' ? '_overdue' : '_pending')}
              onValueChange={(v) => {
                if (v === '_overdue') onFiltersChange({ ...filters, is_completed: undefined, overdue: 'true' })
                else if (v === '_all') onFiltersChange({ ...filters, is_completed: undefined, overdue: undefined })
                else onFiltersChange({ ...filters, is_completed: v as 'true' | 'false', overdue: undefined })
              }}
            >
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Pendentes</SelectItem>
                <SelectItem value="true">Concluídas</SelectItem>
                <SelectItem value="_overdue">Em atraso</SelectItem>
                <SelectItem value="_all">Todas</SelectItem>
              </SelectContent>
            </Select>
          </PopoverContent>
        </Popover>
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={onNewTask}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Desktop: all in one line */}
      <div className="hidden md:flex items-center gap-2">
        <div className="relative w-56 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={filters.search || ''}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <Select value={filters.assigned_to || '_all'} onValueChange={(v) => onFiltersChange({ ...filters, assigned_to: v === '_all' ? undefined : v })}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Atribuído a" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            {currentUserId && <SelectItem value={currentUserId}>As minhas</SelectItem>}
            {consultants.map((c) => <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.priority ? String(filters.priority) : '_all'} onValueChange={(v) => onFiltersChange({ ...filters, priority: v === '_all' ? undefined : Number(v) })}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas</SelectItem>
            {Object.entries(TASK_PRIORITY_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${v.dot}`} />{v.label}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.is_completed || (filters.overdue === 'true' ? '_overdue' : '_pending')}
          onValueChange={(v) => {
            if (v === '_overdue') onFiltersChange({ ...filters, is_completed: undefined, overdue: 'true' })
            else if (v === '_all') onFiltersChange({ ...filters, is_completed: undefined, overdue: undefined })
            else onFiltersChange({ ...filters, is_completed: v as 'true' | 'false', overdue: undefined })
          }}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="false">Pendentes</SelectItem>
            <SelectItem value="true">Concluídas</SelectItem>
            <SelectItem value="_overdue">Em atraso</SelectItem>
            <SelectItem value="_all">Todas</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}

        <Button size="sm" className="h-8 shrink-0 ml-auto gap-1.5" onClick={onNewTask}>
          <Plus className="h-3.5 w-3.5" /> Nova Tarefa
        </Button>
      </div>
    </div>
  )
}
