'use client'

/**
 * Compact Meta date-range selector: presets (7/14/30/90 dias, este/último mês,
 * tudo) + a "Personalizado" calendar popover. Extracted from MetaSectionTabs so
 * the campaign detail header can reuse the exact control top-right.
 */

import { CalendarDays } from 'lucide-react'
import { format, isValid, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { META_DATE_PRESETS, type MetaDatePreset } from '@/lib/meta/date-range'
import { cn } from '@/lib/utils'

export interface MetaPeriodSelectProps {
  period: MetaDatePreset | 'custom'
  customRange: { from?: string; to?: string }
  onPeriodChange: (p: MetaDatePreset | 'custom') => void
  onCustomRangeChange: (r: { from?: string; to?: string }) => void
  className?: string
}

export function MetaPeriodSelect({
  period,
  customRange,
  onPeriodChange,
  onCustomRangeChange,
  className,
}: MetaPeriodSelectProps) {
  const f = customRange.from && isValid(parseISO(customRange.from)) ? parseISO(customRange.from) : null
  const t = customRange.to && isValid(parseISO(customRange.to)) ? parseISO(customRange.to) : null
  const customLabel =
    f && t
      ? `${format(f, 'dd MMM', { locale: pt })} – ${format(t, 'dd MMM yyyy', { locale: pt })}`
      : f
        ? `Desde ${format(f, 'dd MMM yyyy', { locale: pt })}`
        : 'Escolher datas'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border bg-muted p-0.5">
        <CalendarDays className="text-muted-foreground ml-2 mr-0.5 h-3.5 w-3.5 shrink-0" />
        {META_DATE_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPeriodChange(p.key)}
            className={cn(
              'whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150',
              period === p.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPeriodChange('custom')}
          className={cn(
            'whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150',
            period === 'custom'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Personalizado
        </button>
      </div>

      {period === 'custom' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs">
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              {customLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={{ from: f ?? undefined, to: t ?? undefined }}
              onSelect={(r) =>
                onCustomRangeChange({
                  from: r?.from ? format(r.from, 'yyyy-MM-dd') : undefined,
                  to: r?.to ? format(r.to, 'yyyy-MM-dd') : undefined,
                })
              }
              locale={pt}
              numberOfMonths={2}
              captionLayout="dropdown"
              fromYear={2020}
              toYear={new Date().getFullYear() + 1}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
