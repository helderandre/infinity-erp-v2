'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Loader2, Save, CalendarClock, ChevronDown, Settings2 } from 'lucide-react'
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
  // Modo: usar a agenda do consultor (default) ou horário próprio do imóvel.
  const [customMode, setCustomMode] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

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
      const count =
        (data.rules ?? []).length +
        (data.windows ?? []).length +
        (data.overrides ?? []).length
      setCustomMode(count > 0)
      setAdvancedOpen(((data.windows ?? []).length + (data.overrides ?? []).length) > 0)
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
      // Em modo "agenda do consultor", limpamos qualquer override do imóvel
      // (envia arrays vazios) — o imóvel passa a herdar o consultor.
      const payload = customMode
        ? { rules, windows, overrides }
        : { rules: [], windows: [], overrides: [] }
      const res = await fetch(`/api/properties/${propertyId}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Erro ao guardar')
        return
      }
      toast.success(
        !customMode
          ? 'Este imóvel usa agora a tua agenda de consultor'
          : 'Horário específico deste imóvel guardado'
      )
    } catch {
      toast.error('Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }, [propertyId, rules, windows, overrides, customMode])

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
            Por defeito, as visitas a este imóvel usam a tua agenda de consultor.
          </p>
        </div>
      </div>

      {/* Modo: agenda do consultor (default) vs horário próprio do imóvel */}
      <div className="rounded-lg border bg-muted/20 px-3 py-3 flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="custom-mode" className="text-sm font-medium">
            Horário específico para este imóvel
          </Label>
          <p className="text-[11px] text-muted-foreground max-w-md">
            {customMode
              ? 'Estes horários substituem completamente a tua agenda de consultor — só para este imóvel.'
              : 'Activa só se este imóvel tiver restrições próprias (ex.: acordo com o proprietário). Caso contrário, herda a tua agenda.'}
          </p>
        </div>
        <Switch
          id="custom-mode"
          checked={customMode}
          onCheckedChange={setCustomMode}
        />
      </div>

      {customMode && (
        <>
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

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <Settings2 className="h-3.5 w-3.5" />
                  Avançado — períodos e dias específicos
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', advancedOpen && 'rotate-180')} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-3">
                  <BookingWindowsEditor windows={windows} onChange={setWindows} />
                  <DateOverridesEditor overrides={overrides} onChange={setOverrides} />
                </CollapsibleContent>
              </Collapsible>
            </>
          ) : (
            <AvailabilityCalendarView
              rules={rules}
              windows={windows}
              overrides={overrides}
              onOverridesChange={setOverrides}
            />
          )}
        </>
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
