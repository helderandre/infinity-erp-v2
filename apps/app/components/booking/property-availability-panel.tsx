'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, Save, CalendarClock, Info } from 'lucide-react'
import { toast } from 'sonner'
import { WeeklyAvailabilityEditor, type WeeklyRule } from './weekly-availability-editor'
import { BookingWindowsEditor, type BookingWindow } from './booking-windows-editor'
import { DateOverridesEditor, type DateOverride } from './date-overrides-editor'
import { AvailabilityCalendarView } from './availability-calendar-view'
import { List, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PropertyAvailabilityPanelProps {
  propertyId: string
}

export function PropertyAvailabilityPanel({ propertyId }: PropertyAvailabilityPanelProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rules, setRules] = useState<WeeklyRule[]>([])
  const [windows, setWindows] = useState<BookingWindow[]>([])
  const [overrides, setOverrides] = useState<DateOverride[]>([])
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [initialCount, setInitialCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/availability`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRules(data.rules ?? [])
      setWindows((data.windows ?? []).map((w: BookingWindow) => ({
        start_date: w.start_date,
        end_date: w.end_date,
        note: w.note ?? null,
        active: w.active ?? true,
      })))
      setOverrides((data.overrides ?? []).map((o: DateOverride) => ({
        override_date: o.override_date,
        blocked: o.blocked,
        start_time: o.start_time ?? null,
        end_time: o.end_time ?? null,
        note: o.note ?? null,
      })))
      setInitialCount(
        (data.rules ?? []).length +
        (data.windows ?? []).length +
        (data.overrides ?? []).length
      )
    } catch {
      toast.error('Erro ao carregar disponibilidade do imóvel')
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => { load() }, [load])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, windows, overrides }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Erro ao guardar')
        return
      }
      const total = rules.length + windows.length + overrides.length
      toast.success(
        total === 0
          ? 'Overrides removidos — usa agora disponibilidade do consultor'
          : 'Disponibilidade deste imóvel guardada'
      )
      setInitialCount(total)
    } catch {
      toast.error('Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }, [propertyId, rules, windows, overrides])

  const hasOverride = initialCount > 0

  if (loading) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Disponibilidade deste imóvel
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {hasOverride
              ? 'Este imóvel tem horários próprios que substituem os do consultor.'
              : 'Por defeito, usa-se a disponibilidade do consultor. Define aqui se este imóvel tem restrições específicas (ex.: acordo com proprietário).'}
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-muted/30 border px-3 py-2 text-[11px] text-muted-foreground flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Quando defines horas aqui, <strong>substituem</strong> completamente as do consultor para este imóvel.
          Apaga todos os horários para voltar a usar a disponibilidade padrão do consultor.
        </span>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-muted/40 border w-fit">
        {([
          { key: 'list' as const, label: 'Lista', icon: List },
          { key: 'calendar' as const, label: 'Calendário', icon: CalendarDays },
        ]).map((v) => {
          const Icon = v.icon
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5',
                view === v.key
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3 w-3" />
              {v.label}
            </button>
          )
        })}
      </div>

      {view === 'list' ? (
        <>
          <WeeklyAvailabilityEditor
            rules={rules}
            onChange={setRules}
            showNotes
          />

          <BookingWindowsEditor
            windows={windows}
            onChange={setWindows}
          />

          <DateOverridesEditor
            overrides={overrides}
            onChange={setOverrides}
          />
        </>
      ) : (
        <AvailabilityCalendarView
          rules={rules}
          windows={windows}
          overrides={overrides}
          onOverridesChange={setOverrides}
        />
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button
          onClick={save}
          disabled={saving}
          className="gap-1.5"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </Button>
      </div>
    </div>
  )
}
