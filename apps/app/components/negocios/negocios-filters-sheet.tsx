'use client'

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Search, X, ChevronRight, ChevronDown, UsersIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface ChipOption {
  value: string
  label: string
}

interface NegociosFiltersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  // Filter state + setters
  scenarioOptions: ChipOption[]
  selectedScenarios: string[]
  onScenariosChange: (next: string[]) => void

  statusOptions: ChipOption[]
  selectedStatuses: string[]
  onStatusesChange: (next: string[]) => void

  consultants: { id: string; commercial_name: string }[]
  consultantId: string // 'all' or uuid
  onConsultantChange: (id: string) => void
  /** Quando false (consultor), o selector "Consultor" fica escondido. */
  isManagement: boolean

  dateFrom: string
  onDateFromChange: (v: string) => void
  dateTo: string
  onDateToChange: (v: string) => void

  onClearAll: () => void
  /** Total resultante para o footer "Ver N negócios". */
  liveCount: number | null
  liveLoading?: boolean
}

/* ───────── Chip group helper ───────── */
function ChipGroup({
  options, selected, onToggle,
}: {
  options: ChipOption[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={cn(
              'h-8 px-3 rounded-full text-xs font-medium border transition-colors',
              active
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background/40 text-muted-foreground border-border/50 hover:border-foreground/40 hover:text-foreground',
            )}
            aria-pressed={active}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ───────── Consultant pill — popover with search ───────── */
function ConsultantPill({
  consultants, value, onChange,
}: {
  consultants: { id: string; commercial_name: string }[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const filtered = q.trim().length === 0
    ? consultants
    : consultants.filter((c) => c.commercial_name.toLowerCase().includes(q.toLowerCase()))
  const selectedName = value === 'all' ? null : consultants.find((c) => c.id === value)?.commercial_name

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full inline-flex items-center justify-between gap-2 px-3 h-9 rounded-full border border-border/50 bg-background/40 text-xs text-foreground hover:border-foreground/40 transition-colors"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">
              {selectedName ?? 'Consultor: Todos os consultores'}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[var(--radix-popover-trigger-width)] p-2"
      >
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar..."
            className="h-8 text-xs pl-7 rounded-full"
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto space-y-0.5">
          <button
            type="button"
            onClick={() => { onChange('all'); setOpen(false); setQ('') }}
            className={cn(
              'w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors',
              value === 'all' ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/60',
            )}
          >
            Todos os consultores
          </button>
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id); setOpen(false); setQ('') }}
              className={cn(
                'w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors',
                value === c.id ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/60',
              )}
            >
              {c.commercial_name}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground text-center">Sem resultados.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ───────── Sheet (mobile bottom) ───────── */
export function NegociosFiltersSheet({
  open, onOpenChange,
  scenarioOptions, selectedScenarios, onScenariosChange,
  statusOptions, selectedStatuses, onStatusesChange,
  consultants, consultantId, onConsultantChange, isManagement,
  dateFrom, onDateFromChange, dateTo, onDateToChange,
  onClearAll, liveCount, liveLoading,
}: NegociosFiltersSheetProps) {
  const toggleIn = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          'data-[side=bottom]:h-[85dvh] rounded-t-3xl',
        )}
      >
        <VisuallyHidden>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Refinar a lista de negócios</SheetDescription>
        </VisuallyHidden>
        <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        <SheetHeader className="sr-only">
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>

        {/* Header */}
        <div className="shrink-0 px-6 pt-8 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[20px] font-semibold leading-tight tracking-tight">Filtros</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Refine a lista de negócios
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-full"
                onClick={onClearAll}
              >
                Limpar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-full gap-1"
                onClick={() => onOpenChange(false)}
              >
                Fechar
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Consultor — só visível para gestão */}
          {isManagement && consultants.length > 0 && (
            <div className="mt-4">
              <ConsultantPill
                consultants={consultants}
                value={consultantId}
                onChange={onConsultantChange}
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-6">
          {/* Cenário */}
          <section className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              Cenário
            </p>
            <ChipGroup
              options={scenarioOptions}
              selected={selectedScenarios}
              onToggle={(v) => onScenariosChange(toggleIn(selectedScenarios, v))}
            />
          </section>

          {/* Estado */}
          <section className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              Estado
            </p>
            <ChipGroup
              options={statusOptions}
              selected={selectedStatuses}
              onToggle={(v) => onStatusesChange(toggleIn(selectedStatuses, v))}
            />
          </section>

          {/* Datas */}
          <section className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              Período
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">De</p>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-background/40 border-border/50"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Até</p>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-background/40 border-border/50"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer — live count */}
        <div className="shrink-0 px-6 py-3 border-t border-border/40 bg-background/60 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {liveLoading ? (
              <span className="inline-flex items-center gap-1">A calcular...</span>
            ) : liveCount !== null ? (
              <>
                Ver <span className="font-semibold text-foreground">{liveCount}</span>{' '}
                negócio{liveCount !== 1 ? 's' : ''}
              </>
            ) : null}
          </p>
          <Button
            size="sm"
            className="h-9 rounded-full text-xs px-4 gap-1.5"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-3.5 w-3.5" />
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
