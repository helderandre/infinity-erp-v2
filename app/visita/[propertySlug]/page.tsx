'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  addMonths, eachDayOfInterval, endOfMonth, format, isBefore,
  isSameDay, isSameMonth, startOfDay, startOfMonth, subMonths,
} from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock,
  Loader2, MapPin, Check, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface BookingInfo {
  property: {
    id: string
    slug: string
    title: string
    description: string | null
    listing_price: number | null
    property_type: string | null
    business_type: string | null
    city: string | null
    zone: string | null
    cover_url: string | null
    typology: string | null
    bedrooms: number | null
    bathrooms: number | null
    area_util: number | null
  }
  consultant: {
    name: string | null
    photo_url: string | null
    bio: string | null
  }
  booking: {
    slot_duration_minutes: number
    advance_days: number
    min_notice_hours: number
  }
}

type Stage = 'loading' | 'error' | 'pick' | 'form' | 'submitting' | 'success'

const pad = (n: number) => n.toString().padStart(2, '0')
const dateISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function PublicBookingPage({
  params,
}: {
  params: Promise<{ propertySlug: string }>
}) {
  const { propertySlug } = use(params)

  const [stage, setStage] = useState<Stage>('loading')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [info, setInfo] = useState<BookingInfo | null>(null)
  const [mobileIntroDone, setMobileIntroDone] = useState(false)
  const [monthCursor, setMonthCursor] = useState<Date>(startOfMonth(new Date()))
  const [slotsByDate, setSlotsByDate] = useState<Record<string, string[]>>({})
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [form, setForm] = useState<{
    name: string
    email: string
    phone: string
    message: string
    client_type: 'private' | 'consultant'
    client_agency: string
  }>({ name: '', email: '', phone: '', message: '', client_type: 'private', client_agency: '' })
  const [submitError, setSubmitError] = useState<string>('')

  // Initial info fetch
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/visita/${propertySlug}/info`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setErrorMsg(data.error || 'Erro ao carregar')
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
  }, [propertySlug])

  // Fetch slots when month changes
  useEffect(() => {
    if (stage === 'loading' || stage === 'error') return
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
  }, [monthCursor, propertySlug, stage])

  const monthLabel = useMemo(
    () => format(monthCursor, "MMMM yyyy", { locale: pt }),
    [monthCursor],
  )

  const calendarDays = useMemo(() => {
    const start = startOfMonth(monthCursor)
    const end = endOfMonth(monthCursor)
    const days = eachDayOfInterval({ start, end })
    // Pad beginning: get Monday as first day of week → day-of-week 1 means Mon
    // start.getDay() is 0=Sun...6=Sat. We want Monday first → shift.
    const startWeekday = (start.getDay() + 6) % 7 // 0 if Mon, 6 if Sun
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
    setStage('form')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate || !selectedTime) return
    setSubmitError('')
    setStage('submitting')
    try {
      const res = await fetch(`/api/visita/${propertySlug}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          date: selectedDate,
          time: selectedTime,
          message: form.message.trim() || undefined,
          client_type: form.client_type,
          client_agency: form.client_type === 'consultant' ? form.client_agency.trim() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || 'Erro ao enviar pedido')
        setStage('form')
        return
      }
      setStage('success')
    } catch {
      setSubmitError('Erro de rede')
      setStage('form')
    }
  }

  // ─── Render states ───
  if (stage === 'loading') {
    return <LoadingScreen />
  }

  if (stage === 'error' || !info) {
    return <ErrorScreen message={errorMsg} />
  }

  if (stage === 'success') {
    return <SuccessScreen info={info} date={selectedDate!} time={selectedTime!} />
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-neutral-900 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold">Agendar visita</span>
          </div>
          {stage === 'form' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStage('pick')}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
          )}
          {stage === 'pick' && mobileIntroDone && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileIntroDone(false)}
              className="lg:hidden gap-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        {stage === 'pick' && (
          <>
            {/* Mobile: full intro card (step 1) */}
            {!mobileIntroDone && (
              <div className="lg:hidden">
                <PropertyIntroCard
                  info={info}
                  onStart={() => setMobileIntroDone(true)}
                />
              </div>
            )}

            {/* Picker layout — always on desktop, hidden on mobile until intro is dismissed */}
            <div className={cn(
              'grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] gap-4 lg:gap-5',
              !mobileIntroDone && 'hidden lg:grid',
            )}>
              {/* Desktop only: full property sidebar */}
              <div className="hidden lg:block">
                <PropertyInfoPanel info={info} />
              </div>

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

              {/* Slots: always shown on desktop, only when date picked on mobile */}
              <div className={cn(
                'lg:block',
                !selectedDate && 'hidden',
              )}>
                <SlotsPanel
                  selectedDate={selectedDate}
                  slots={selectedSlots}
                  onSelectTime={handleSelectTime}
                />
              </div>
            </div>
          </>
        )}

        {stage === 'form' || stage === 'submitting' ? (
          <BookingForm
            info={info}
            date={selectedDate!}
            time={selectedTime!}
            form={form}
            onChange={setForm}
            onSubmit={handleSubmit}
            submitting={stage === 'submitting'}
            submitError={submitError}
          />
        ) : null}
      </main>

      <footer className="text-center text-[11px] text-muted-foreground py-4">
        Infinity Group · Powered by ERP Infinity
      </footer>
    </div>
  )
}

// ─── Mobile intro card (step 1 on mobile) ───
function PropertyIntroCard({ info, onStart }: { info: BookingInfo; onStart: () => void }) {
  const { property, consultant, booking } = info
  const priceLabel = property.listing_price
    ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(property.listing_price))
    : null

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm animate-in fade-in duration-300">
      {/* Hero image */}
      {property.cover_url ? (
        <div className="relative aspect-[16/10] bg-muted">
          <Image
            src={property.cover_url}
            alt={property.title}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>
      ) : (
        <div className="aspect-[16/10] bg-muted flex items-center justify-center">
          <MapPin className="h-10 w-10 text-muted-foreground/40" />
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Title + location */}
        <div className="space-y-1">
          <h1 className="text-lg font-semibold leading-tight">{property.title}</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {[property.zone, property.city].filter(Boolean).join(', ') || '—'}
          </p>
        </div>

        {priceLabel && (
          <div className="text-xl font-bold">{priceLabel}</div>
        )}

        {/* Specs */}
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {property.typology && (
            <span className="rounded-full bg-muted px-2.5 py-1 font-medium">{property.typology}</span>
          )}
          {property.bedrooms != null && (
            <span className="rounded-full bg-muted px-2.5 py-1">{property.bedrooms} quartos</span>
          )}
          {property.bathrooms != null && (
            <span className="rounded-full bg-muted px-2.5 py-1">{property.bathrooms} WC</span>
          )}
          {property.area_util && (
            <span className="rounded-full bg-muted px-2.5 py-1">{property.area_util}m²</span>
          )}
        </div>

        {/* Consultant + duration */}
        <div className="pt-4 border-t space-y-2">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9">
              {consultant.photo_url && <AvatarImage src={consultant.photo_url} alt={consultant.name ?? ''} />}
              <AvatarFallback className="text-xs">
                {consultant.name?.split(' ').slice(0, 2).map((n) => n[0]).join('') ?? 'C'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground leading-tight">Com</p>
              <p className="text-sm font-medium truncate">{consultant.name ?? 'Consultor'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Visita de {booking.slot_duration_minutes} minutos
          </div>
        </div>

        {/* CTA */}
        <Button
          onClick={onStart}
          size="lg"
          className="w-full h-12 gap-2 bg-neutral-900 text-white hover:bg-neutral-800 text-sm font-semibold"
        >
          Ver datas disponíveis
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Sub-components ───

function PropertyInfoPanel({ info }: { info: BookingInfo }) {
  const { property, consultant, booking } = info
  const priceLabel = property.listing_price
    ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(property.listing_price))
    : null

  return (
    <aside className="rounded-2xl border bg-card overflow-hidden h-fit">
      {property.cover_url ? (
        <div className="relative aspect-[4/3] bg-muted">
          <Image
            src={property.cover_url}
            alt={property.title}
            fill
            className="object-cover"
            sizes="320px"
            priority
          />
        </div>
      ) : (
        <div className="aspect-[4/3] bg-muted flex items-center justify-center">
          <MapPin className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <h1 className="text-base font-semibold leading-tight">{property.title}</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {[property.zone, property.city].filter(Boolean).join(', ') || '—'}
          </p>
        </div>

        {priceLabel && (
          <div className="text-lg font-bold">{priceLabel}</div>
        )}

        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {property.typology && (
            <span className="rounded-full bg-muted px-2 py-0.5">{property.typology}</span>
          )}
          {property.bedrooms != null && (
            <span className="rounded-full bg-muted px-2 py-0.5">{property.bedrooms} quartos</span>
          )}
          {property.bathrooms != null && (
            <span className="rounded-full bg-muted px-2 py-0.5">{property.bathrooms} WC</span>
          )}
          {property.area_util && (
            <span className="rounded-full bg-muted px-2 py-0.5">{property.area_util}m²</span>
          )}
        </div>

        <div className="pt-3 border-t flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            {consultant.photo_url && <AvatarImage src={consultant.photo_url} alt={consultant.name ?? ''} />}
            <AvatarFallback className="text-[11px]">
              {consultant.name?.split(' ').slice(0, 2).map((n) => n[0]).join('') ?? 'C'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-tight">Com</p>
            <p className="text-sm font-medium truncate">{consultant.name ?? 'Consultor'}</p>
          </div>
        </div>

        <div className="pt-3 border-t space-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Duração: {booking.slot_duration_minutes} minutos
          </div>
          <div>Mín. {booking.min_notice_hours}h de antecedência · até {booking.advance_days} dias no futuro</div>
        </div>
      </div>
    </aside>
  )
}

function CalendarPanel({
  monthCursor,
  monthLabel,
  canGoPrev,
  onPrev,
  onNext,
  days,
  slotsByDate,
  selectedDate,
  onSelectDate,
  loadingSlots,
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
    <div className="rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <h2 className="text-base font-semibold capitalize">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onPrev}
            disabled={!canGoPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3 font-semibold">
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
                'flex flex-col items-center justify-center min-h-[44px]',
                !clickable && 'text-muted-foreground/25 cursor-not-allowed',
                clickable && !isSelected && 'font-semibold text-foreground hover:bg-muted active:bg-muted',
                isSelected && 'bg-neutral-900 text-white font-semibold shadow-md dark:bg-white dark:text-neutral-900',
                isToday && !isSelected && 'ring-1 ring-inset ring-primary/50',
              )}
            >
              <span>{day.getDate()}</span>
              {clickable && !isSelected && (
                <span className="absolute bottom-1 sm:bottom-1.5 h-1 w-1 rounded-full bg-emerald-500" />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 pt-4 border-t flex items-center justify-center gap-5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Disponível
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-neutral-900 dark:bg-white" />
          Seleccionado
        </span>
      </div>

      {loadingSlots && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          A carregar disponibilidade...
        </div>
      )}
    </div>
  )
}

function SlotsPanel({
  selectedDate,
  slots,
  onSelectTime,
}: {
  selectedDate: string | null
  slots: string[]
  onSelectTime: (time: string) => void
}) {
  if (!selectedDate) {
    return (
      <div className="rounded-2xl border bg-muted/20 border-dashed p-6 flex flex-col items-center justify-center text-center h-fit min-h-[240px]">
        <CalendarDays className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Escolhe um dia
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">
          Os dias com ponto verde têm horários disponíveis.
        </p>
      </div>
    )
  }

  const friendlyDay = format(new Date(selectedDate + 'T00:00:00'), "EEEE", { locale: pt })
  const friendlyDate = format(new Date(selectedDate + 'T00:00:00'), "d 'de' MMMM", { locale: pt })

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3 h-fit">
      <div>
        <h3 className="text-sm font-semibold capitalize leading-tight">{friendlyDay}</h3>
        <p className="text-xs text-muted-foreground capitalize">{friendlyDate}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {slots.length} {slots.length === 1 ? 'horário' : 'horários'}
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-2 gap-1.5 lg:max-h-[460px] lg:overflow-y-auto pr-1">
        {slots.map((time) => (
          <button
            key={time}
            type="button"
            onClick={() => onSelectTime(time)}
            className="rounded-lg border bg-background hover:bg-neutral-900 hover:text-white hover:border-neutral-900 active:bg-neutral-900 active:text-white dark:hover:bg-white dark:hover:text-neutral-900 transition-all text-sm font-medium py-3 min-h-[44px]"
          >
            {time}
          </button>
        ))}
      </div>
    </div>
  )
}

function BookingForm({
  info,
  date,
  time,
  form,
  onChange,
  onSubmit,
  submitting,
  submitError,
}: {
  info: BookingInfo
  date: string
  time: string
  form: { name: string; email: string; phone: string; message: string; client_type: 'private' | 'consultant'; client_agency: string }
  onChange: (next: typeof form) => void
  onSubmit: (e: React.FormEvent) => void
  submitting: boolean
  submitError: string
}) {
  const friendly = format(new Date(date + 'T00:00:00'), "EEEE, d 'de' MMMM", { locale: pt })
  const canSubmit =
    form.name.trim().length >= 2 &&
    form.email.trim().length >= 5 &&
    form.phone.trim().length >= 6 &&
    (form.client_type === 'private' || form.client_agency.trim().length >= 2)

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-6 space-y-5 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Confirma os teus dados</h2>
          <p className="text-xs text-muted-foreground">
            Vamos enviar estes detalhes ao consultor para confirmação.
          </p>
        </div>

        <div className="rounded-xl bg-muted/30 border p-3 space-y-1 text-sm">
          <p className="font-medium">{info.property.title}</p>
          <p className="text-xs text-muted-foreground capitalize">{friendly} às {time}</p>
          <p className="text-xs text-muted-foreground">Com {info.consultant.name ?? 'consultor'} · {info.booking.slot_duration_minutes} min</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">És *</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...form, client_type: 'private' })}
              disabled={submitting}
              className={cn(
                'rounded-xl border px-3 py-3 text-left transition-all',
                form.client_type === 'private'
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <div className="text-sm font-medium">Privado(a)</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Estou a ver para mim</div>
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...form, client_type: 'consultant' })}
              disabled={submitting}
              className={cn(
                'rounded-xl border px-3 py-3 text-left transition-all',
                form.client_type === 'consultant'
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <div className="text-sm font-medium">Consultor(a)</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Represento uma imobiliária</div>
            </button>
          </div>
        </div>

        {form.client_type === 'consultant' && (
          <div className="space-y-1.5">
            <Label htmlFor="agency" className="text-xs">Agência / imobiliária *</Label>
            <Input
              id="agency"
              value={form.client_agency}
              onChange={(e) => onChange({ ...form, client_agency: e.target.value })}
              placeholder="Ex: RE/MAX, ERA, Century 21..."
              required
              maxLength={120}
              disabled={submitting}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name" className="text-xs">Nome completo *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              required
              minLength={2}
              maxLength={120}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => onChange({ ...form, email: e.target.value })}
              required
              maxLength={160}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs">Telemóvel *</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => onChange({ ...form, phone: e.target.value })}
              required
              maxLength={40}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="message" className="text-xs">Mensagem (opcional)</Label>
            <Textarea
              id="message"
              value={form.message}
              onChange={(e) => onChange({ ...form, message: e.target.value })}
              rows={3}
              maxLength={1000}
              placeholder="Alguma pergunta ou pedido específico?"
              disabled={submitting}
            />
          </div>
        </div>

        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit || submitting}
          className="w-full gap-2 bg-neutral-900 text-white hover:bg-neutral-800"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> A enviar...</>
          ) : (
            <>Pedir visita</>
          )}
        </Button>

        <p className="text-[10px] text-muted-foreground text-center">
          O consultor vai receber o teu pedido e confirmará em breve por email.
        </p>
      </form>
    </div>
  )
}

function SuccessScreen({ info, date, time }: { info: BookingInfo; date: string; time: string }) {
  const friendly = format(new Date(date + 'T00:00:00'), "EEEE, d 'de' MMMM", { locale: pt })

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full rounded-2xl border bg-card shadow-sm p-8 text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Check className="h-7 w-7 text-emerald-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Pedido enviado</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A tua solicitação para visitar <strong>{info.property.title}</strong> foi enviada ao consultor.
          </p>
        </div>

        <div className="rounded-xl bg-muted/30 border p-4 text-left space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="capitalize">{friendly} às {time}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{info.booking.slot_duration_minutes} minutos</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          O consultor vai confirmar a tua visita em breve por email.
        </p>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <Skeleton className="h-6 w-32" />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] gap-5">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </main>
    </div>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-3 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold">Não foi possível carregar</h1>
        <p className="text-sm text-muted-foreground">
          {message || 'O imóvel não está disponível para agendamento público.'}
        </p>
      </div>
    </div>
  )
}
