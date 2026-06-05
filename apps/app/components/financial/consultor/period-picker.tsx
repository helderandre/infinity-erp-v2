'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'

export type PeriodPreset = 'week' | 'month' | 'year' | 'custom'

const LABELS: Record<PeriodPreset, string> = {
  week: 'Esta semana',
  month: 'Este mês',
  year: 'Este ano',
  custom: 'Personalizado',
}

export interface PeriodValue {
  preset: PeriodPreset
  customRange?: DateRange
}

/** Resolve um PeriodValue para um intervalo ISO inclusive. */
export function rangeForPeriod(value: PeriodValue): { from?: string; to?: string } {
  const now = new Date()
  switch (value.preset) {
    case 'week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }).toISOString().slice(0, 10), to: endOfWeek(now, { weekStartsOn: 1 }).toISOString().slice(0, 10) }
    case 'month':
      return { from: startOfMonth(now).toISOString().slice(0, 10), to: endOfMonth(now).toISOString().slice(0, 10) }
    case 'year':
      return { from: startOfYear(now).toISOString().slice(0, 10), to: endOfYear(now).toISOString().slice(0, 10) }
    case 'custom': {
      if (!value.customRange?.from || !value.customRange.to) return {}
      return {
        from: startOfDay(value.customRange.from).toISOString().slice(0, 10),
        to: endOfDay(value.customRange.to).toISOString().slice(0, 10),
      }
    }
  }
}

interface Props {
  value: PeriodValue
  onChange: (value: PeriodValue) => void
  className?: string
}

export function PeriodPicker({ value, onChange, className }: Props) {
  const [customOpen, setCustomOpen] = useState(false)

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={value.preset}
          onValueChange={(preset: PeriodPreset) => {
            onChange({ ...value, preset })
            if (preset === 'custom') setCustomOpen(true)
          }}
        >
          <SelectTrigger className="h-8 text-xs w-auto rounded-full bg-muted/50 border-border/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(LABELS) as PeriodPreset[]).map((p) => (
              <SelectItem key={p} value={p}>{LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {value.preset === 'custom' && (
          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full text-xs font-normal"
              >
                <CalendarIcon className="mr-1.5 h-3 w-3" />
                {value.customRange?.from && value.customRange.to
                  ? `${format(value.customRange.from, 'dd/MM/yy', { locale: pt })} – ${format(value.customRange.to, 'dd/MM/yy', { locale: pt })}`
                  : 'Escolher datas'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={value.customRange}
                onSelect={(r) => onChange({ ...value, customRange: r })}
                locale={pt}
                numberOfMonths={2}
                captionLayout="dropdown"
                defaultMonth={value.customRange?.from ?? new Date()}
                fromYear={2020}
                toYear={2040}
              />
              <div className="flex justify-end gap-2 border-t p-2">
                <Button variant="ghost" size="sm" onClick={() => onChange({ ...value, customRange: undefined })}>
                  Limpar
                </Button>
                <Button
                  size="sm"
                  disabled={!value.customRange?.from || !value.customRange.to}
                  onClick={() => setCustomOpen(false)}
                >
                  Aplicar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}
