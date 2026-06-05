'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/kibo-ui/spinner'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/**
 * Quick event sheet for the contact detail context. Strips down the full
 * `<CalendarEventForm>` (3 tabs, 18 fields) to the bare minimum for
 * "marcar o próximo passo com este contacto":
 *
 *   - Tipo  (Reunião / Visita / Chamada / Outro) → maps to `category`
 *   - Data + hora início + duração (30m/1h/2h/Personalizado)
 *   - Local (opcional)
 *   - Notas (opcional textarea)
 *   - Lembrete (Sem / 15min / 1h / 1d antes)
 *
 * Hardcoded server-side: visibility='private', is_private=true, no recurrence,
 * no cover image, no links, no RSVP, no notify_mode. Lead is auto-attached
 * via `lead_id` in the POST body.
 */

const TIPOS = [
  { key: 'meeting', label: 'Reunião' },
  { key: 'meeting', label: 'Visita', sub: 'visita' },
  { key: 'meeting', label: 'Chamada', sub: 'chamada' },
  { key: 'custom', label: 'Outro' },
] as const

// Internal helper to surface the visit/chamada distinction in the title prefix
// while keeping the DB `category` enum legal (only meeting|custom|... exist).
type TipoOption = (typeof TIPOS)[number]

const DURACOES = [
  { key: 30, label: '30 min' },
  { key: 60, label: '1 h' },
  { key: 120, label: '2 h' },
  { key: 0, label: 'Personalizado' },
] as const

const LEMBRETES = [
  { key: -1, label: 'Sem lembrete' },
  { key: 15, label: '15 min antes' },
  { key: 60, label: '1 h antes' },
  { key: 1440, label: '1 dia antes' },
] as const

interface QuickEventSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  /** Auto-prefills the title as "Reunião com {contactName}" */
  contactName?: string | null
  onSaved?: () => void
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

function nextRoundedHour(): { date: string; time: string } {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return { date, time }
}

export function QuickEventSheet({
  open,
  onOpenChange,
  contactId,
  contactName,
  onSaved,
}: QuickEventSheetProps) {
  const isMobile = useIsMobile()

  const [tipo, setTipo] = useState<TipoOption>(TIPOS[0])
  const [title, setTitle] = useState('')
  const [{ date, time }, setStart] = useState(nextRoundedHour)
  const [duration, setDuration] = useState<number>(60)
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [reminder, setReminder] = useState<number>(15)
  const [submitting, setSubmitting] = useState(false)

  // Reset on open with a sensible default title
  useEffect(() => {
    if (!open) return
    const reset = nextRoundedHour()
    setStart(reset)
    setDuration(60)
    setEndDate('')
    setEndTime('')
    setLocation('')
    setNotes('')
    setReminder(15)
    setTipo(TIPOS[0])
    const prefix = TIPOS[0].label
    setTitle(contactName ? `${prefix} com ${contactName}` : '')
  }, [open, contactName])

  // When tipo or contactName changes, refresh the title prefix only when the
  // user hasn't customised it past the default pattern.
  useEffect(() => {
    if (!open) return
    setTitle((prev) => {
      const prefix = tipo.label
      const next = contactName ? `${prefix} com ${contactName}` : prefix
      // Heuristic: only auto-update when the previous value still looks like
      // a generated default (starts with one of the known prefixes followed
      // by " com ").
      const looksLikeDefault = TIPOS.some(
        (t) =>
          prev === t.label ||
          (contactName && prev === `${t.label} com ${contactName}`),
      )
      return looksLikeDefault || !prev.trim() ? next : prev
    })
  }, [tipo, contactName, open])

  const startISO = useMemo(() => {
    if (!date || !time) return ''
    return new Date(`${date}T${time}:00`).toISOString()
  }, [date, time])

  const endISO = useMemo(() => {
    if (!startISO) return null
    if (duration === 0) {
      // Personalizado — only emit when both end fields are filled
      if (!endDate || !endTime) return null
      return new Date(`${endDate}T${endTime}:00`).toISOString()
    }
    const start = new Date(startISO)
    start.setMinutes(start.getMinutes() + duration)
    return start.toISOString()
  }, [startISO, duration, endDate, endTime])

  const canSubmit = !!title.trim() && !!startISO && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const reminders =
        reminder >= 0 ? [{ minutes_before: reminder }] : []

      const payload = {
        title: title.trim(),
        description: notes.trim() || null,
        category: tipo.key, // 'meeting' for reunião/visita/chamada, 'custom' for outro
        item_type: 'event' as const,
        start_date: startISO,
        end_date: endISO,
        all_day: false,
        is_recurring: false,
        recurrence_rule: null,
        lead_id: contactId,
        visibility: 'private' as const,
        location: location.trim() || null,
        reminders,
        is_private: true,
        notify_mode: 'none' as const,
      }

      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success('Evento criado')
      onSaved?.()
      onOpenChange(false)
    } catch {
      toast.error('Erro ao criar evento')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full sm:max-w-[520px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader
          className={cn(
            'px-6 pb-4 border-b border-border/40 shrink-0',
            isMobile ? 'pt-8' : 'pt-6',
          )}
        >
          <SheetTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="h-5 w-5" />
            Novo evento
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Marca o próximo passo com este contacto. Fica automaticamente associado.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3">
          <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-4">
            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {TIPOS.map((t, idx) => {
                  const active = tipo.label === t.label
                  return (
                    <button
                      key={`${t.label}-${idx}`}
                      type="button"
                      onClick={() => setTipo(t)}
                      className={cn(
                        'inline-flex items-center justify-center h-9 rounded-full text-xs font-medium transition-all border',
                        active
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/70',
                      )}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="ev-title">Título *</Label>
              <Input
                id="ev-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex.: Reunião com João Silva"
              />
            </div>

            {/* Data + hora */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="ev-date">Data *</Label>
                <Input
                  id="ev-date"
                  type="date"
                  value={date}
                  onChange={(e) => setStart((s) => ({ ...s, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-time">Hora *</Label>
                <Input
                  id="ev-time"
                  type="time"
                  value={time}
                  onChange={(e) => setStart((s) => ({ ...s, time: e.target.value }))}
                />
              </div>
            </div>

            {/* Duração */}
            <div className="space-y-2">
              <Label>Duração</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {DURACOES.map((d) => {
                  const active = duration === d.key
                  return (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => setDuration(d.key)}
                      className={cn(
                        'inline-flex items-center justify-center h-9 rounded-full text-xs font-medium transition-all border',
                        active
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/70',
                      )}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
              {duration === 0 && (
                <div className="grid grid-cols-2 gap-2 pt-2 animate-in fade-in slide-in-from-top-1">
                  <div className="space-y-1">
                    <Label htmlFor="ev-end-date" className="text-[11px]">Fim — data</Label>
                    <Input
                      id="ev-end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ev-end-time" className="text-[11px]">Fim — hora</Label>
                    <Input
                      id="ev-end-time"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Local */}
            <div className="space-y-2">
              <Label htmlFor="ev-location">Local</Label>
              <Input
                id="ev-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Opcional — morada, escritório, etc."
              />
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label htmlFor="ev-notes">Notas</Label>
              <Textarea
                id="ev-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional — agenda, contexto, decisões a tomar…"
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Lembrete */}
            <div className="space-y-2">
              <Label>Lembrete</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {LEMBRETES.map((l) => {
                  const active = reminder === l.key
                  return (
                    <button
                      key={l.label}
                      type="button"
                      onClick={() => setReminder(l.key)}
                      className={cn(
                        'inline-flex items-center justify-center h-9 rounded-full text-[11px] font-medium transition-all border px-2',
                        active
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/70',
                      )}
                    >
                      {l.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md px-6 py-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-w-[120px]"
          >
            {submitting && <Spinner variant="infinite" size={16} className="mr-2" />}
            Criar evento
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
