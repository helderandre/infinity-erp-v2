'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type Temperatura = 'Frio' | 'Morno' | 'Quente' | null

export interface TemperaturaOption {
  value: Exclude<Temperatura, null>
  emoji: string
  label: string
  /** CSS color used for chip background tint and text */
  color: string
}

export const TEMPERATURA_OPTIONS: TemperaturaOption[] = [
  { value: 'Frio',   emoji: '❄️',  label: 'Frio',   color: '#3b82f6' },
  { value: 'Morno',  emoji: '🌤️', label: 'Morno',  color: '#f59e0b' },
  { value: 'Quente', emoji: '🔥',  label: 'Quente', color: '#ef4444' },
]

export function temperaturaEmoji(t: Temperatura | undefined): string | null {
  if (!t) return null
  return TEMPERATURA_OPTIONS.find((o) => o.value === t)?.emoji ?? null
}

interface TemperaturaSelectorProps {
  value: Temperatura | undefined
  onChange: (next: Temperatura) => void
}

export function TemperaturaSelector({ value, onChange }: TemperaturaSelectorProps) {
  const current = TEMPERATURA_OPTIONS.find((o) => o.value === value)
  const triggerColor = current?.color || '#94a3b8'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-semibold h-7 px-2.5 transition-opacity hover:opacity-90 border-0"
          style={{
            backgroundColor: `${triggerColor}33`,
            color: triggerColor,
            ['--tw-ring-color' as any]: `${triggerColor}66`,
          }}
          aria-label="Temperatura"
        >
          {current ? (
            <>
              <span aria-hidden className="text-xs leading-none">{current.emoji}</span>
              <span>{current.label}</span>
            </>
          ) : (
            <>
              <span aria-hidden className="text-xs leading-none">🌡️</span>
              <span>Temperatura</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1.5" align="start">
        <div className="flex flex-col gap-0.5">
          {TEMPERATURA_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left',
                value === opt.value && 'bg-muted font-medium'
              )}
            >
              <span aria-hidden className="text-base">{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          ))}
          {value && (
            <>
              <div className="h-px bg-border my-0.5" />
              <button
                type="button"
                onClick={() => onChange(null)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors text-left"
              >
                Limpar
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
