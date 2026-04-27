'use client'

import { useRef, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TASK_PRIORITY_MAP } from '@/types/task'
import { cn } from '@/lib/utils'

interface TaskFiltersProps {
  filters: {
    assigned_to?: string
    priority?: number
    is_completed?: 'true' | 'false'
    overdue?: 'true' | 'false'
    search?: string
    // source_filter NÃO é editável pelo user, mas tem de ser preservado
    // entre updates dos outros filtros (caso contrário o split em tabs perde-se)
    source_filter?: 'personal' | 'process'
  }
  onFiltersChange: (filters: any) => void
  onNewTask: () => void
  consultants: Array<{ id: string; commercial_name: string }>
  currentUserId?: string
}

export function TaskFilters({ filters, onFiltersChange, consultants, currentUserId }: TaskFiltersProps) {
  const hasFilters = filters.assigned_to || filters.priority || filters.is_completed || filters.overdue
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchOpen, setSearchOpen] = useState(!!filters.search)

  const activeFilterCount = [
    filters.assigned_to,
    filters.priority,
    filters.is_completed === 'true',
    filters.overdue === 'true',
  ].filter(Boolean).length

  const clearFilters = () => {
    onFiltersChange({
      search: filters.search,
      source_filter: filters.source_filter,
    })
  }

  const clearSearch = () => {
    onFiltersChange({ ...filters, search: undefined })
    setSearchOpen(false)
  }

  const openSearch = () => {
    setSearchOpen(true)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  const filtersPopover = (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative inline-flex items-center justify-center size-8 rounded-full transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            activeFilterCount > 0 && 'text-foreground',
          )}
          aria-label="Filtros"
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
          {activeFilterCount > 0 && (
            <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-4 rounded-2xl border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight">Filtros</span>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-background/60 transition-colors"
            >
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>

        {/* Estado — pill row */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1">Estado</p>
          <div className="grid grid-cols-2 gap-1">
            {([
              { key: 'pending', label: 'Pendentes' },
              { key: 'completed', label: 'Concluídas' },
              { key: 'overdue', label: 'Em atraso' },
              { key: 'all', label: 'Todas' },
            ] as const).map((opt) => {
              const current =
                filters.overdue === 'true' ? 'overdue'
                : filters.is_completed === 'true' ? 'completed'
                : filters.is_completed === 'false' ? 'pending'
                : 'all'
              const active = current === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    if (opt.key === 'overdue') onFiltersChange({ ...filters, is_completed: undefined, overdue: 'true' })
                    else if (opt.key === 'all') onFiltersChange({ ...filters, is_completed: undefined, overdue: undefined })
                    else if (opt.key === 'completed') onFiltersChange({ ...filters, is_completed: 'true', overdue: undefined })
                    else onFiltersChange({ ...filters, is_completed: 'false', overdue: undefined })
                  }}
                  className={cn(
                    'rounded-full text-xs font-medium px-3 py-1.5 border transition-colors',
                    active
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/70',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Prioridade — pill row */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1">Prioridade</p>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onFiltersChange({ ...filters, priority: undefined })}
              className={cn(
                'rounded-full text-xs font-medium px-3 py-1 border transition-colors',
                !filters.priority
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground',
              )}
            >
              Todas
            </button>
            {Object.entries(TASK_PRIORITY_MAP).map(([k, v]) => {
              const active = filters.priority === Number(k)
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, priority: Number(k) })}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full text-xs font-medium px-3 py-1 border transition-colors',
                    active
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground',
                  )}
                  title={v.label}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', v.dot)} />
                  {v.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Atribuído a */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1">Atribuído a</p>
          <Select
            value={filters.assigned_to || '_all'}
            onValueChange={(v) => onFiltersChange({ ...filters, assigned_to: v === '_all' ? undefined : v })}
          >
            <SelectTrigger className="h-9 text-xs rounded-xl border-border/40 bg-background/40 backdrop-blur-sm">
              <SelectValue placeholder="Toda a equipa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Toda a equipa</SelectItem>
              {currentUserId && <SelectItem value={currentUserId}>As minhas</SelectItem>}
              {consultants.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  )

  // ─── Expanded search input (shared between mobile and desktop) ────────────
  const searchInput = (
    <div className="relative flex-1 min-w-0">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Pesquisar..."
        value={filters.search || ''}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
        onBlur={() => { if (!filters.search) setSearchOpen(false) }}
        onKeyDown={(e) => { if (e.key === 'Escape') clearSearch() }}
        className={cn(
          'w-full bg-transparent pl-7 pr-7 h-8 text-[13px] outline-none',
          'placeholder:text-muted-foreground/50',
        )}
      />
      {filters.search && (
        <button
          type="button"
          onClick={clearSearch}
          className="absolute right-1 top-1/2 -translate-y-1/2 size-5 rounded-full hover:bg-muted/70 text-muted-foreground hover:text-foreground flex items-center justify-center"
          aria-label="Limpar pesquisa"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )

  return (
    <div className="flex items-center gap-1 rounded-full border border-border/40 bg-background/40 backdrop-blur-sm pl-2 pr-1 py-0.5">
      {searchOpen ? (
        searchInput
      ) : (
        <button
          type="button"
          onClick={openSearch}
          className="flex-1 flex items-center gap-2 py-1.5 text-[12.5px] text-muted-foreground/70 hover:text-foreground rounded-md transition-colors min-w-0"
        >
          <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="truncate">Pesquisar tarefas</span>
        </button>
      )}

      {filtersPopover}
    </div>
  )
}
