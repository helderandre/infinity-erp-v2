'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, Save, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { WeeklyAvailabilityEditor, type WeeklyRule } from './weekly-availability-editor'
import { BookingWindowsEditor, type BookingWindow } from './booking-windows-editor'
import { DateOverridesEditor, type DateOverride } from './date-overrides-editor'
import { AvailabilityCalendarView } from './availability-calendar-view'
import { List, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Settings {
  slot_duration_minutes: number
  buffer_minutes: number
  advance_days: number
  min_notice_hours: number
  public_booking_enabled: boolean
}

const DEFAULTS: Settings = {
  slot_duration_minutes: 30,
  buffer_minutes: 0,
  advance_days: 30,
  min_notice_hours: 24,
  public_booking_enabled: false,
}

export function ConsultantAvailabilityPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rules, setRules] = useState<WeeklyRule[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [windows, setWindows] = useState<BookingWindow[]>([])
  const [overrides, setOverrides] = useState<DateOverride[]>([])
  const [view, setView] = useState<'list' | 'calendar'>('list')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/consultant-availability')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRules(data.rules ?? [])
      setSettings({
        slot_duration_minutes: data.settings?.slot_duration_minutes ?? DEFAULTS.slot_duration_minutes,
        buffer_minutes: data.settings?.buffer_minutes ?? DEFAULTS.buffer_minutes,
        advance_days: data.settings?.advance_days ?? DEFAULTS.advance_days,
        min_notice_hours: data.settings?.min_notice_hours ?? DEFAULTS.min_notice_hours,
        public_booking_enabled: data.settings?.public_booking_enabled ?? DEFAULTS.public_booking_enabled,
      })
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
    } catch {
      toast.error('Erro ao carregar disponibilidade')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/consultant-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, settings, windows, overrides }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Erro ao guardar')
        return
      }
      toast.success('Disponibilidade guardada')
    } catch {
      toast.error('Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }, [rules, settings, windows, overrides])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Agendamento público
            </CardTitle>
            <CardDescription>
              Permite que prospects agendem visitas directamente através de um link público dos imóveis associados a ti.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor="public-toggle" className="text-xs text-muted-foreground">
              {settings.public_booking_enabled ? 'Activo' : 'Inactivo'}
            </Label>
            <Switch
              id="public-toggle"
              checked={settings.public_booking_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, public_booking_enabled: v })}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Settings grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Duração do slot (min)
            </Label>
            <Input
              type="number"
              min={5}
              max={240}
              step={5}
              value={settings.slot_duration_minutes}
              onChange={(e) => setSettings({ ...settings, slot_duration_minutes: Number(e.target.value) || 30 })}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Buffer entre visitas (min)
            </Label>
            <Input
              type="number"
              min={0}
              max={240}
              step={5}
              value={settings.buffer_minutes}
              onChange={(e) => setSettings({ ...settings, buffer_minutes: Number(e.target.value) || 0 })}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Agendar até (dias no futuro)
            </Label>
            <Input
              type="number"
              min={1}
              max={180}
              value={settings.advance_days}
              onChange={(e) => setSettings({ ...settings, advance_days: Number(e.target.value) || 30 })}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Antecedência mínima (horas)
            </Label>
            <Input
              type="number"
              min={0}
              max={168}
              value={settings.min_notice_hours}
              onChange={(e) => setSettings({ ...settings, min_notice_hours: Number(e.target.value) || 0 })}
              className="h-9 text-sm"
            />
          </div>
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
            Guardar disponibilidade
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
