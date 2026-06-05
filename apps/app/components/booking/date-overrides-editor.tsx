'use client'

import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, CalendarOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DateOverride {
  override_date: string   // YYYY-MM-DD
  blocked: boolean
  start_time?: string | null
  end_time?: string | null
  note?: string | null
}

interface DateOverridesEditorProps {
  overrides: DateOverride[]
  onChange: (overrides: DateOverride[]) => void
  disabled?: boolean
}

const today = () => {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function DateOverridesEditor({ overrides, onChange, disabled }: DateOverridesEditorProps) {
  const update = useCallback(
    (idx: number, patch: Partial<DateOverride>) => {
      const next = [...overrides]
      next[idx] = { ...next[idx], ...patch }
      onChange(next)
    },
    [overrides, onChange]
  )

  const remove = useCallback(
    (idx: number) => {
      onChange(overrides.filter((_, i) => i !== idx))
    },
    [overrides, onChange]
  )

  const add = useCallback(() => {
    onChange([
      ...overrides,
      { override_date: today(), blocked: true, start_time: null, end_time: null, note: null },
    ])
  }, [overrides, onChange])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <CalendarOff className="h-3.5 w-3.5" />
            Dias específicos (excepções)
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Bloqueia ou altera horas de dias específicos (férias, horário especial).
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
            <Plus className="h-3 w-3" /> Adicionar dia
          </Button>
        )}
      </div>

      {overrides.length > 0 && (
        <div className="rounded-xl border divide-y">
          {overrides.map((o, idx) => (
            <div key={idx} className="p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="date"
                  value={o.override_date}
                  onChange={(e) => update(idx, { override_date: e.target.value })}
                  disabled={disabled}
                  className="h-8 text-xs w-40"
                />
                <div className="flex items-center gap-1 p-0.5 rounded-full border bg-muted/40">
                  <button
                    type="button"
                    onClick={() => update(idx, { blocked: true, start_time: null, end_time: null })}
                    disabled={disabled}
                    className={cn(
                      'px-3 py-0.5 rounded-full text-[11px] font-medium transition-all',
                      o.blocked ? 'bg-destructive text-destructive-foreground shadow-sm' : 'text-muted-foreground'
                    )}
                  >
                    Bloqueado
                  </button>
                  <button
                    type="button"
                    onClick={() => update(idx, { blocked: false, start_time: '09:00', end_time: '18:00' })}
                    disabled={disabled}
                    className={cn(
                      'px-3 py-0.5 rounded-full text-[11px] font-medium transition-all',
                      !o.blocked ? 'bg-neutral-900 text-white shadow-sm' : 'text-muted-foreground'
                    )}
                  >
                    Horas custom
                  </button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(idx)}
                  disabled={disabled}
                  className="h-8 w-8 ml-auto text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {!o.blocked && (
                <div className="flex items-center gap-2 pl-1">
                  <Input
                    type="time"
                    value={o.start_time ?? ''}
                    onChange={(e) => update(idx, { start_time: e.target.value })}
                    disabled={disabled}
                    className="h-8 w-28 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input
                    type="time"
                    value={o.end_time ?? ''}
                    onChange={(e) => update(idx, { end_time: e.target.value })}
                    disabled={disabled}
                    className="h-8 w-28 text-xs"
                  />
                </div>
              )}
              <Input
                type="text"
                value={o.note ?? ''}
                onChange={(e) => update(idx, { note: e.target.value || null })}
                disabled={disabled}
                placeholder="Nota (opcional) — ex: 'Férias', 'Open House'"
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
