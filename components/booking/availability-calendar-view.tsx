'use client'

import { useMemo, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, format, isBefore, isSameDay, isSameMonth, startOfDay, startOfMonth, subMonths } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ChevronLeft, ChevronRight, Ban, Clock, RotateCcw, MousePointer2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeeklyRule } from './weekly-availability-editor'
import type { BookingWindow } from './booking-windows-editor'
import type { DateOverride } from './date-overrides-editor'

interface AvailabilityCalendarViewProps {
  rules: WeeklyRule[]
  windows: BookingWindow[]
  overrides: DateOverride[]
  onOverridesChange: (overrides: DateOverride[]) => void
  disabled?: boolean
}

const pad = (n: number) => n.toString().padStart(2, '0')
const dateISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

type DayStatus =
  | { kind: 'past' }
  | { kind: 'outside-window' }
  | { kind: 'blocked'; override: DateOverride }
  | { kind: 'custom'; override: DateOverride }
  | { kind: 'available'; ranges: { start: string; end: string }[] }
  | { kind: 'unavailable' }

export function AvailabilityCalendarView({
  rules, windows, overrides, onOverridesChange, disabled,
}: AvailabilityCalendarViewProps) {
  const [monthCursor, setMonthCursor] = useState<Date>(startOfMonth(new Date()))
  const [openDayISO, setOpenDayISO] = useState<string | null>(null)
  const [customStart, setCustomStart] = useState('09:00')
  const [customEnd, setCustomEnd] = useState('18:00')

  // Multi-select state
  const [multiMode, setMultiMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastClicked, setLastClicked] = useState<string | null>(null)
  const [bulkCustomOpen, setBulkCustomOpen] = useState(false)
  const [bulkStart, setBulkStart] = useState('09:00')
  const [bulkEnd, setBulkEnd] = useState('18:00')

  const today = useMemo(() => startOfDay(new Date()), [])
  const monthLabel = useMemo(
    () => format(monthCursor, "MMMM yyyy", { locale: pt }),
    [monthCursor],
  )

  const overrideByDate = useMemo(() => {
    const map = new Map<string, DateOverride>()
    for (const o of overrides) map.set(o.override_date, o)
    return map
  }, [overrides])

  const activeWindows = useMemo(
    () => windows.filter((w) => w.active !== false),
    [windows],
  )

  const isWithinWindows = (iso: string): boolean => {
    if (activeWindows.length === 0) return true
    return activeWindows.some((w) => iso >= w.start_date && iso <= w.end_date)
  }

  const rulesForDay = (dow: number): { start: string; end: string }[] =>
    rules
      .filter((r) => r.day_of_week === dow && r.active !== false)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((r) => ({ start: r.start_time, end: r.end_time }))

  const dayStatus = (d: Date): DayStatus => {
    if (isBefore(d, today)) return { kind: 'past' }
    const iso = dateISO(d)
    const override = overrideByDate.get(iso)
    if (override) {
      if (override.blocked) return { kind: 'blocked', override }
      return { kind: 'custom', override }
    }
    if (!isWithinWindows(iso)) return { kind: 'outside-window' }
    const ranges = rulesForDay(d.getDay())
    if (ranges.length > 0) return { kind: 'available', ranges }
    return { kind: 'unavailable' }
  }

  const calendarDays = useMemo(() => {
    const start = startOfMonth(monthCursor)
    const end = endOfMonth(monthCursor)
    const days = eachDayOfInterval({ start, end })
    const startWeekday = (start.getDay() + 6) % 7 // Monday = 0
    const padding: (Date | null)[] = Array.from({ length: startWeekday }, () => null)
    return [...padding, ...days]
  }, [monthCursor])

  // ─── single-day actions ───
  const applyBlockSingle = (iso: string) => {
    const rest = overrides.filter((o) => o.override_date !== iso)
    onOverridesChange([...rest, {
      override_date: iso,
      blocked: true,
      start_time: null,
      end_time: null,
      note: null,
    }])
    setOpenDayISO(null)
  }

  const applyCustomHoursSingle = (iso: string) => {
    if (customEnd <= customStart) return
    const rest = overrides.filter((o) => o.override_date !== iso)
    onOverridesChange([...rest, {
      override_date: iso,
      blocked: false,
      start_time: customStart,
      end_time: customEnd,
      note: null,
    }])
    setOpenDayISO(null)
  }

  const clearOverrideSingle = (iso: string) => {
    onOverridesChange(overrides.filter((o) => o.override_date !== iso))
    setOpenDayISO(null)
  }

  // ─── multi-select actions ───
  const toggleSelection = (iso: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
    setLastClicked(iso)
  }

  const extendSelectionTo = (iso: string) => {
    if (!lastClicked) {
      toggleSelection(iso)
      return
    }
    const from = lastClicked < iso ? lastClicked : iso
    const to = lastClicked < iso ? iso : lastClicked
    // Enumerate dates between from and to (inclusive) and add to selection (only if not past / in-month)
    const start = new Date(from + 'T00:00:00')
    const end = new Date(to + 'T00:00:00')
    const range = eachDayOfInterval({ start, end })
    const next = new Set(selected)
    for (const d of range) {
      if (isBefore(d, today)) continue
      next.add(dateISO(d))
    }
    setSelected(next)
    setLastClicked(iso)
  }

  const applyBulkBlock = () => {
    if (selected.size === 0) return
    const untouched = overrides.filter((o) => !selected.has(o.override_date))
    const adds: DateOverride[] = Array.from(selected).map((iso) => ({
      override_date: iso,
      blocked: true,
      start_time: null,
      end_time: null,
      note: null,
    }))
    onOverridesChange([...untouched, ...adds])
    setSelected(new Set())
  }

  const applyBulkCustom = () => {
    if (selected.size === 0) return
    if (bulkEnd <= bulkStart) return
    const untouched = overrides.filter((o) => !selected.has(o.override_date))
    const adds: DateOverride[] = Array.from(selected).map((iso) => ({
      override_date: iso,
      blocked: false,
      start_time: bulkStart,
      end_time: bulkEnd,
      note: null,
    }))
    onOverridesChange([...untouched, ...adds])
    setSelected(new Set())
    setBulkCustomOpen(false)
  }

  const applyBulkReset = () => {
    if (selected.size === 0) return
    onOverridesChange(overrides.filter((o) => !selected.has(o.override_date)))
    setSelected(new Set())
  }

  const exitMultiMode = () => {
    setMultiMode(false)
    setSelected(new Set())
    setLastClicked(null)
  }

  return (
    <div className="space-y-3 relative">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h4 className="text-sm font-semibold">Vista de calendário</h4>
          <p className="text-[11px] text-muted-foreground">
            Visualiza a disponibilidade combinada e gere excepções por dia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={multiMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              if (multiMode) exitMultiMode()
              else setMultiMode(true)
            }}
            disabled={disabled}
            className={cn(
              'h-7 text-[11px] gap-1.5',
              multiMode && 'bg-neutral-900 text-white hover:bg-neutral-800'
            )}
          >
            <MousePointer2 className="h-3 w-3" />
            {multiMode ? 'Sair de selecção' : 'Seleccionar múltiplos'}
          </Button>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setMonthCursor(subMonths(monthCursor, 1))}
              disabled={isBefore(today, monthCursor) ? false : true}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold capitalize min-w-[120px] text-center">{monthLabel}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setMonthCursor(addMonths(monthCursor, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {multiMode && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-[11px] text-muted-foreground">
          Click nos dias para seleccionar. <strong>Shift+click</strong> para seleccionar um intervalo.
        </div>
      )}

      <div className="rounded-xl border bg-card p-4 pb-24">
        <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="text-center">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, i) => {
            if (!day) return <div key={i} />

            const iso = dateISO(day)
            const status = dayStatus(day)
            const isToday = isSameDay(day, today)
            const inMonth = isSameMonth(day, monthCursor)
            const clickable = inMonth && !disabled && status.kind !== 'past'
            const isSelected = multiMode && selected.has(iso)

            const statusStyle = (() => {
              if (isSelected) {
                return 'bg-neutral-900 text-white font-semibold ring-2 ring-primary dark:bg-white dark:text-neutral-900'
              }
              switch (status.kind) {
                case 'past': return 'text-muted-foreground/25 cursor-not-allowed'
                case 'outside-window': return 'text-muted-foreground/50 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.04)_4px,rgba(0,0,0,0.04)_8px)]'
                case 'blocked': return 'bg-red-500/10 text-red-700 font-semibold hover:bg-red-500/20'
                case 'custom': return 'bg-amber-500/10 text-amber-700 font-semibold hover:bg-amber-500/20'
                case 'available': return 'bg-emerald-500/10 text-emerald-700 font-semibold hover:bg-emerald-500/20'
                case 'unavailable': return 'text-muted-foreground/60 hover:bg-muted'
              }
            })()

            if (multiMode) {
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!clickable}
                  onClick={(e) => {
                    if (e.shiftKey) extendSelectionTo(iso)
                    else toggleSelection(iso)
                  }}
                  className={cn(
                    'relative aspect-square rounded-lg text-sm transition-all flex items-center justify-center',
                    statusStyle,
                    isToday && !isSelected && 'ring-1 ring-inset ring-primary/60',
                  )}
                  title={labelForStatus(status)}
                >
                  <span>{day.getDate()}</span>
                </button>
              )
            }

            return (
              <Popover
                key={iso}
                open={openDayISO === iso}
                onOpenChange={(o) => {
                  if (o) {
                    const override = overrideByDate.get(iso)
                    if (override && !override.blocked && override.start_time && override.end_time) {
                      setCustomStart(override.start_time.slice(0, 5))
                      setCustomEnd(override.end_time.slice(0, 5))
                    } else {
                      const dayRules = rulesForDay(day.getDay())
                      if (dayRules.length > 0) {
                        setCustomStart(dayRules[0].start.slice(0, 5))
                        setCustomEnd(dayRules[0].end.slice(0, 5))
                      } else {
                        setCustomStart('09:00')
                        setCustomEnd('18:00')
                      }
                    }
                    setOpenDayISO(iso)
                  } else {
                    setOpenDayISO(null)
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={!clickable}
                    className={cn(
                      'relative aspect-square rounded-lg text-sm transition-all flex items-center justify-center',
                      statusStyle,
                      isToday && 'ring-1 ring-inset ring-primary/60',
                    )}
                    title={labelForStatus(status)}
                  >
                    <span>{day.getDate()}</span>
                  </button>
                </PopoverTrigger>
                {clickable && (
                  <PopoverContent className="w-64 p-3 space-y-2" align="start">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold capitalize">
                        {format(day, "EEEE, d 'de' MMMM", { locale: pt })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {labelForStatus(status)}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t">
                      {status.kind !== 'blocked' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => applyBlockSingle(iso)}
                          className="w-full justify-start h-8 text-[11px] gap-1.5 text-red-700 hover:text-red-700"
                        >
                          <Ban className="h-3 w-3" /> Bloquear este dia
                        </Button>
                      )}

                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Horas personalizadas</p>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="time"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="h-8 flex-1 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">—</span>
                          <Input
                            type="time"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="h-8 flex-1 text-xs"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => applyCustomHoursSingle(iso)}
                          disabled={customEnd <= customStart}
                          className="w-full h-8 text-[11px] gap-1.5 bg-neutral-900 text-white hover:bg-neutral-800"
                        >
                          <Clock className="h-3 w-3" /> Aplicar horas
                        </Button>
                      </div>

                      {(status.kind === 'blocked' || status.kind === 'custom') && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => clearOverrideSingle(iso)}
                          className="w-full justify-start h-8 text-[11px] gap-1.5 text-muted-foreground"
                        >
                          <RotateCcw className="h-3 w-3" /> Repor padrão
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t flex items-center justify-center gap-4 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-emerald-500/30" />
            Disponível
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-amber-500/30" />
            Horas custom
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-red-500/30" />
            Bloqueado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded border" />
            Sem horas / fora janela
          </span>
        </div>
      </div>

      {/* Floating action bar for multi-select */}
      {multiMode && selected.size > 0 && (
        <div className="sticky bottom-0 z-10 rounded-xl border bg-neutral-900 text-white shadow-lg p-2 flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <div className="flex-1 text-xs font-medium px-2">
            {selected.size} {selected.size === 1 ? 'dia seleccionado' : 'dias seleccionados'}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={applyBulkBlock}
            className="h-7 text-[11px] gap-1 bg-red-600 hover:bg-red-700 text-white"
          >
            <Ban className="h-3 w-3" /> Bloquear
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              // Pre-fill from first selected
              const firstIso = Array.from(selected).sort()[0]
              const override = overrideByDate.get(firstIso)
              if (override && !override.blocked && override.start_time && override.end_time) {
                setBulkStart(override.start_time.slice(0, 5))
                setBulkEnd(override.end_time.slice(0, 5))
              } else {
                setBulkStart('09:00')
                setBulkEnd('18:00')
              }
              setBulkCustomOpen(true)
            }}
            className="h-7 text-[11px] gap-1 bg-white text-neutral-900 hover:bg-white/90"
          >
            <Clock className="h-3 w-3" /> Horas
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={applyBulkReset}
            className="h-7 text-[11px] gap-1 text-white/70 hover:text-white hover:bg-white/10"
          >
            <RotateCcw className="h-3 w-3" /> Repor
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setSelected(new Set())}
            className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Bulk custom hours dialog */}
      <Dialog open={bulkCustomOpen} onOpenChange={setBulkCustomOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Horas personalizadas</DialogTitle>
            <DialogDescription>
              Aplica o mesmo intervalo de horas a <strong>{selected.size} dia{selected.size > 1 ? 's' : ''}</strong> seleccionado{selected.size > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">De</Label>
                <Input
                  type="time"
                  value={bulkStart}
                  onChange={(e) => setBulkStart(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Até</Label>
                <Input
                  type="time"
                  value={bulkEnd}
                  onChange={(e) => setBulkEnd(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCustomOpen(false)}>Cancelar</Button>
            <Button
              onClick={applyBulkCustom}
              disabled={bulkEnd <= bulkStart}
              className="bg-neutral-900 text-white hover:bg-neutral-800"
            >
              Aplicar a {selected.size} {selected.size === 1 ? 'dia' : 'dias'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function labelForStatus(status: DayStatus): string {
  switch (status.kind) {
    case 'past': return 'Data passada'
    case 'outside-window': return 'Fora de uma janela activa'
    case 'blocked': return 'Bloqueado' + (status.override.note ? ` · ${status.override.note}` : '')
    case 'custom': return `Horas custom: ${(status.override.start_time ?? '').slice(0, 5)} — ${(status.override.end_time ?? '').slice(0, 5)}`
    case 'available': return 'Disponível: ' + status.ranges.map((r) => `${r.start.slice(0, 5)}—${r.end.slice(0, 5)}`).join(', ')
    case 'unavailable': return 'Sem horário para este dia da semana'
  }
}
