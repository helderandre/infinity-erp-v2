'use client'

/**
 * RequestVisitDialog — cal.com-style in-app booking flow for non-owner
 * consultants requesting a visit on a colleague's listing.
 *
 * Flow:
 *  1. Pick a date with available slots (calendar view)
 *  2. Pick a time slot
 *  3. Pick one of the consultant's own negócios as the context for the visit
 *  4. Submit → POST /api/visits with { negocio_id, ... }, lead_id is derived
 *     server-side from the negócio
 *
 * Reads availability from the existing public endpoints (which only require
 * the property slug):
 *   GET /api/visita/[slug]/info
 *   GET /api/visita/[slug]/slots?from=…&to=…
 *
 * Lists the consultant's negócios via /api/negocios (already self-scoped
 * server-side for non-management).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addMonths, eachDayOfInterval, endOfMonth, format, isBefore,
  isSameDay, isSameMonth, startOfDay, startOfMonth, subMonths,
} from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  AlertCircle, ArrowLeft, CalendarDays, Check, ChevronLeft,
  ChevronRight, Clock, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface BookingInfo {
  property: { id: string; title: string }
  consultant: { name: string | null; photo_url: string | null }
  booking: { slot_duration_minutes: number; advance_days: number; min_notice_hours: number }
}

interface NegocioOption {
  id: string
  tipo: string | null
  estado: string | null
  localizacao: string | null
  lead: { id: string; nome: string | null; full_name: string | null } | null
}

type Stage = 'loading' | 'error' | 'pick' | 'negocio' | 'submitting' | 'success'

interface RequestVisitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Slug do imóvel — usado nos endpoints públicos `/api/visita/[slug]/{info,slots}`. */
  propertySlug: string
  /** Id do imóvel — usado no POST /api/visits. */
  propertyId: string
  /** Consultor autenticado — `consultant_id` no INSERT. */
  consultantId: string
  /** Título do imóvel para mostrar em ecrãs de cabeçalho. */
  propertyTitle?: string | null
  onSuccess?: () => void
}

const pad = (n: number) => n.toString().padStart(2, '0')
const dateISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function RequestVisitDialog({
  open,
  onOpenChange,
  propertySlug,
  propertyId,
  consultantId,
  propertyTitle,
  onSuccess,
}: RequestVisitDialogProps) {
  const [stage, setStage] = useState<Stage>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [info, setInfo] = useState<BookingInfo | null>(null)
  const [monthCursor, setMonthCursor] = useState<Date>(startOfMonth(new Date()))
  const [slotsByDate, setSlotsByDate] = useState<Record<string, string[]>>({})
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [negocios, setNegocios] = useState<NegocioOption[]>([])
  const [loadingNegocios, setLoadingNegocios] = useState(false)
  const [selectedNegocioId, setSelectedNegocioId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')

  // Reset state when dialog closes — opening it again starts fresh.
  useEffect(() => {
    if (open) return
    setStage('loading')
    setInfo(null)
    setErrorMsg('')
    setMonthCursor(startOfMonth(new Date()))
    setSlotsByDate({})
    setSelectedDate(null)
    setSelectedTime(null)
    setSelectedNegocioId(null)
    setSubmitError('')
  }, [open])

  // Initial info fetch when dialog opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/visita/${propertySlug}/info`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setErrorMsg(data.error || 'Erro ao carregar disponibilidade')
          setStage('error')
          return
        }
        setInfo(data)
        setStage('pick')
      } catch {
        if (cancelled) return
        setErrorMsg('Erro de rede')
        setStage('error')
      }
    })()
    return () => { cancelled = true }
  }, [open, propertySlug])

  // Fetch slots when month cursor changes.
  useEffect(() => {
    if (!open || stage === 'loading' || stage === 'error') return
    let cancelled = false
    const from = dateISO(startOfMonth(monthCursor))
    const to = dateISO(endOfMonth(monthCursor))
    setLoadingSlots(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/visita/${propertySlug}/slots?from=${from}&to=${to}`)
        const data = await res.json()
        if (cancelled) return
        setSlotsByDate(data.slots ?? {})
      } catch {
        if (cancelled) return
        setSlotsByDate({})
      } finally {
        if (!cancelled) setLoadingSlots(false)
      }
    })()
    return () => { cancelled = true }
  }, [monthCursor, open, propertySlug, stage])

  // Fetch consultant's own negócios when entering the negócio step.
  useEffect(() => {
    if (stage !== 'negocio' || negocios.length > 0) return
    let cancelled = false
    setLoadingNegocios(true)
    ;(async () => {
      try {
        const res = await fetch('/api/negocios?limit=100')
        const data = await res.json()
        if (cancelled) return
        // Server already self-scopes to assigned_consultant_id = self for
        // non-management. We surface a flat option list ordered by created_at.
        const list: NegocioOption[] = (data.data ?? []).map((n: any) => ({
          id: n.id,
          tipo: n.tipo ?? null,
          estado: n.estado ?? null,
          localizacao: n.localizacao ?? null,
          lead: n.lead
            ? {
                id: n.lead.id,
                nome: n.lead.nome ?? null,
                full_name: n.lead.full_name ?? null,
              }
            : null,
        }))
        // Hide negócios on terminal stages — user wants the relation to be
        // an active deal. Terminal flag isn't on the row, so we filter on a
        // pragmatic estado-blacklist matching the current pipeline labels.
        const TERMINAL_ESTADOS = new Set(['Concluído', 'Perdido', 'Cancelado'])
        setNegocios(list.filter((n) => !n.estado || !TERMINAL_ESTADOS.has(n.estado)))
      } catch {
        if (cancelled) return
        setNegocios([])
      } finally {
        if (!cancelled) setLoadingNegocios(false)
      }
    })()
    return () => { cancelled = true }
  }, [stage, negocios.length])

  const monthLabel = useMemo(
    () => format(monthCursor, 'MMMM yyyy', { locale: pt }),
    [monthCursor],
  )

  const calendarDays = useMemo(() => {
    const start = startOfMonth(monthCursor)
    const end = endOfMonth(monthCursor)
    const days = eachDayOfInterval({ start, end })
    const startWeekday = (start.getDay() + 6) % 7
    const padding: (Date | null)[] = Array.from({ length: startWeekday }, () => null)
    return [...padding, ...days]
  }, [monthCursor])

  const today = useMemo(() => startOfDay(new Date()), [])
  const canGoPrev = isBefore(today, monthCursor)
  const selectedSlots = selectedDate ? (slotsByDate[selectedDate] ?? []) : []

  const handleSelectDate = (d: Date) => {
    const iso = dateISO(d)
    if ((slotsByDate[iso] ?? []).length === 0) return
    setSelectedDate(iso)
    setSelectedTime(null)
  }

  const handleSelectTime = (time: string) => {
    setSelectedTime(time)
    setStage('negocio')
  }

  const handleSubmit = useCallback(async () => {
    if (!selectedDate || !selectedTime || !selectedNegocioId) return
    setSubmitError('')
    setStage('submitting')
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          consultant_id: consultantId,
          negocio_id: selectedNegocioId,
          visit_date: selectedDate,
          visit_time: selectedTime,
          duration_minutes: info?.booking.slot_duration_minutes ?? 30,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || 'Erro ao registar pedido de visita')
        setStage('negocio')
        return
      }
      toast.success('Pedido de visita enviado ao colega')
      setStage('success')
      onSuccess?.()
    } catch {
      setSubmitError('Erro de rede')
      setStage('negocio')
    }
  }, [
    selectedDate, selectedTime, selectedNegocioId, propertyId, consultantId,
    info?.booking.slot_duration_minutes, onSuccess,
  ])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[680px] p-0 sm:rounded-l-3xl bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0"
      >
        <SheetHeader className="shrink-0 px-6 pt-6 pb-3 flex-row items-start justify-between gap-3 border-b border-border/40">
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base font-semibold leading-tight">
              {stage === 'success' ? 'Pedido enviado' : 'Solicitar visita'}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Escolher data e hora para solicitar uma visita ao imóvel.
            </SheetDescription>
            {info?.consultant.name && stage !== 'success' && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Disponibilidade de {info.consultant.name}
                {propertyTitle ? ` · ${propertyTitle}` : ''}
              </p>
            )}
          </div>
          {stage === 'negocio' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStage('pick')}
              className="gap-1.5 text-xs h-8"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
          )}
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {stage === 'loading' && <LoadingState />}
          {stage === 'error' && <ErrorState message={errorMsg} />}

          {stage === 'pick' && info && (
            <div className="space-y-4">
              <ConsultantStrip info={info} />
              <CalendarPanel
                monthCursor={monthCursor}
                monthLabel={monthLabel}
                canGoPrev={canGoPrev}
                onPrev={() => setMonthCursor(subMonths(monthCursor, 1))}
                onNext={() => setMonthCursor(addMonths(monthCursor, 1))}
                days={calendarDays}
                slotsByDate={slotsByDate}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                loadingSlots={loadingSlots}
              />
              {selectedDate && (
                <SlotsPanel
                  selectedDate={selectedDate}
                  slots={selectedSlots}
                  onSelectTime={handleSelectTime}
                />
              )}
            </div>
          )}

          {(stage === 'negocio' || stage === 'submitting') && info && selectedDate && selectedTime && (
            <NegocioStep
              info={info}
              date={selectedDate}
              time={selectedTime}
              negocios={negocios}
              loading={loadingNegocios}
              selectedId={selectedNegocioId}
              onSelect={setSelectedNegocioId}
              onSubmit={handleSubmit}
              submitting={stage === 'submitting'}
              submitError={submitError}
            />
          )}

          {stage === 'success' && info && selectedDate && selectedTime && (
            <SuccessState
              info={info}
              date={selectedDate}
              time={selectedTime}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ConsultantStrip({ info }: { info: BookingInfo }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/30 border px-3 py-2.5">
      <Avatar className="h-9 w-9">
        {info.consultant.photo_url && (
          <AvatarImage src={info.consultant.photo_url} alt={info.consultant.name ?? ''} />
        )}
        <AvatarFallback className="text-[11px]">
          {info.consultant.name?.split(' ').slice(0, 2).map((n) => n[0]).join('') ?? 'C'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground leading-tight">Com</p>
        <p className="text-sm font-medium truncate">{info.consultant.name ?? 'Consultor'}</p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
        <Clock className="h-3 w-3" />
        {info.booking.slot_duration_minutes} min
      </div>
    </div>
  )
}

function CalendarPanel({
  monthCursor, monthLabel, canGoPrev, onPrev, onNext, days,
  slotsByDate, selectedDate, onSelectDate, loadingSlots,
}: {
  monthCursor: Date
  monthLabel: string
  canGoPrev: boolean
  onPrev: () => void
  onNext: () => void
  days: (Date | null)[]
  slotsByDate: Record<string, string[]>
  selectedDate: string | null
  onSelectDate: (d: Date) => void
  loadingSlots: boolean
}) {
  const today = startOfDay(new Date())
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold capitalize">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onPrev} disabled={!canGoPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>
      <div className={cn('grid grid-cols-7 gap-1 transition-opacity', loadingSlots && 'opacity-50')}>
        {days.map((day, i) => {
          if (!day) return <div key={i} />
          const iso = dateISO(day)
          const hasSlots = (slotsByDate[iso] ?? []).length > 0
          const isPast = isBefore(day, today)
          const isSelected = selectedDate === iso
          const isToday = isSameDay(day, today)
          const clickable = hasSlots && !isPast && isSameMonth(day, monthCursor)
          return (
            <button
              key={iso}
              type="button"
              disabled={!clickable}
              onClick={() => onSelectDate(day)}
              className={cn(
                'relative aspect-square rounded-full text-sm transition-all',
                'flex flex-col items-center justify-center min-h-[40px]',
                !clickable && 'text-muted-foreground/25 cursor-not-allowed',
                clickable && !isSelected && 'font-semibold text-foreground hover:bg-muted active:bg-muted',
                isSelected && 'bg-neutral-900 text-white font-semibold shadow-md dark:bg-white dark:text-neutral-900',
                isToday && !isSelected && 'ring-1 ring-inset ring-primary/50',
              )}
            >
              <span>{day.getDate()}</span>
              {clickable && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-500" />
              )}
            </button>
          )
        })}
      </div>
      {loadingSlots && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          A carregar disponibilidade...
        </div>
      )}
    </div>
  )
}

function SlotsPanel({
  selectedDate, slots, onSelectTime,
}: {
  selectedDate: string
  slots: string[]
  onSelectTime: (time: string) => void
}) {
  const friendlyDay = format(new Date(selectedDate + 'T00:00:00'), 'EEEE', { locale: pt })
  const friendlyDate = format(new Date(selectedDate + 'T00:00:00'), "d 'de' MMMM", { locale: pt })

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold capitalize leading-tight">{friendlyDay}</h3>
        <p className="text-xs text-muted-foreground capitalize">{friendlyDate}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {slots.length} {slots.length === 1 ? 'horário disponível' : 'horários disponíveis'}
        </p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {slots.map((time) => (
          <button
            key={time}
            type="button"
            onClick={() => onSelectTime(time)}
            className="rounded-lg border bg-background hover:bg-neutral-900 hover:text-white hover:border-neutral-900 active:bg-neutral-900 active:text-white dark:hover:bg-white dark:hover:text-neutral-900 transition-all text-sm font-medium py-2.5 min-h-[40px]"
          >
            {time}
          </button>
        ))}
      </div>
    </div>
  )
}

function NegocioStep({
  info, date, time, negocios, loading, selectedId, onSelect, onSubmit, submitting, submitError,
}: {
  info: BookingInfo
  date: string
  time: string
  negocios: NegocioOption[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onSubmit: () => void
  submitting: boolean
  submitError: string
}) {
  const friendly = format(new Date(date + 'T00:00:00'), "EEEE, d 'de' MMMM", { locale: pt })

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-muted/30 border p-3 space-y-1 text-sm">
        <p className="font-medium">{info.property.title}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {friendly} às {time}
        </p>
        <p className="text-xs text-muted-foreground">
          Com {info.consultant.name ?? 'consultor'} · {info.booking.slot_duration_minutes} min
        </p>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-1">A que negócio está associada?</h4>
        <p className="text-xs text-muted-foreground mb-3">
          O colega só vê o teu nome — nunca os dados do lead. A visita aparece no negócio escolhido.
        </p>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : negocios.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">Não tens negócios activos.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Cria um negócio antes de marcar a visita.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
            {negocios.map((n) => {
              const leadName = n.lead?.full_name || n.lead?.nome || 'Sem lead'
              const isSelected = selectedId === n.id
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onSelect(n.id)}
                  className={cn(
                    'w-full text-left rounded-xl border px-3 py-2.5 transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{leadName}</span>
                    {n.tipo && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                        {n.tipo}
                      </span>
                    )}
                  </div>
                  {(n.localizacao || n.estado) && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                      {[n.localizacao, n.estado].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {submitError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <Button
        type="button"
        size="lg"
        disabled={!selectedId || submitting}
        onClick={onSubmit}
        className="w-full gap-2 bg-neutral-900 text-white hover:bg-neutral-800"
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> A enviar...</>
        ) : (
          <>Pedir visita</>
        )}
      </Button>
    </div>
  )
}

function SuccessState({
  info, date, time, onClose,
}: {
  info: BookingInfo
  date: string
  time: string
  onClose: () => void
}) {
  const friendly = format(new Date(date + 'T00:00:00'), "EEEE, d 'de' MMMM", { locale: pt })
  return (
    <div className="flex flex-col items-center text-center py-6 space-y-4">
      <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
        <Check className="h-6 w-6 text-emerald-600" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold">Pedido enviado a {info.consultant.name ?? 'consultor'}</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          Vais receber confirmação assim que o colega aceitar. Vês o estado da visita no detalhe do negócio.
        </p>
      </div>
      <div className="rounded-xl bg-muted/30 border p-3 text-left space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="capitalize">{friendly} às {time}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{info.booking.slot_duration_minutes} minutos</span>
        </div>
      </div>
      <Button variant="outline" onClick={onClose} className="rounded-full">
        Fechar
      </Button>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3 py-2">
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center text-center py-10 space-y-3">
      <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-5 w-5 text-destructive" />
      </div>
      <p className="text-sm font-semibold">Não foi possível carregar a disponibilidade</p>
      <p className="text-xs text-muted-foreground max-w-sm">
        {message || 'O colega ainda não tem disponibilidade configurada para este imóvel.'}
      </p>
    </div>
  )
}
