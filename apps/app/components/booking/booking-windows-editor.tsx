'use client'

import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, CalendarRange } from 'lucide-react'

export interface BookingWindow {
  start_date: string      // YYYY-MM-DD
  end_date: string
  note?: string | null
  active?: boolean
}

interface BookingWindowsEditorProps {
  windows: BookingWindow[]
  onChange: (windows: BookingWindow[]) => void
  disabled?: boolean
}

const today = () => {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function BookingWindowsEditor({ windows, onChange, disabled }: BookingWindowsEditorProps) {
  const update = useCallback(
    (idx: number, patch: Partial<BookingWindow>) => {
      const next = [...windows]
      next[idx] = { ...next[idx], ...patch }
      onChange(next)
    },
    [windows, onChange]
  )

  const remove = useCallback(
    (idx: number) => {
      onChange(windows.filter((_, i) => i !== idx))
    },
    [windows, onChange]
  )

  const add = useCallback(() => {
    const start = today()
    onChange([
      ...windows,
      { start_date: start, end_date: addDays(start, 6), note: null, active: true },
    ])
  }, [windows, onChange])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" />
            Períodos de disponibilidade
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Se vazio, disponível sempre (dentro dos limites globais).
          </p>
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={add}
            className="h-7 text-[11px] gap-1"
          >
            <Plus className="h-3 w-3" /> Adicionar período
          </Button>
        )}
      </div>

      {windows.length > 0 && (
        <div className="rounded-xl border divide-y">
          {windows.map((w, idx) => (
            <div key={idx} className="p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="date"
                  value={w.start_date}
                  onChange={(e) => update(idx, { start_date: e.target.value })}
                  disabled={disabled}
                  className="h-8 text-xs flex-1 min-w-[120px]"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={w.end_date}
                  onChange={(e) => update(idx, { end_date: e.target.value })}
                  disabled={disabled}
                  className="h-8 text-xs flex-1 min-w-[120px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(idx)}
                  disabled={disabled}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                type="text"
                value={w.note ?? ''}
                onChange={(e) => update(idx, { note: e.target.value || null })}
                disabled={disabled}
                placeholder="Nota (opcional) — ex: 'Campanha de Primavera'"
                className="h-8 text-xs"
                maxLength={200}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
