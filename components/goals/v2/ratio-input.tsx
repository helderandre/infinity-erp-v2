'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface RatioInputProps {
  /** "Para cada 1 [outputLabel]" */
  outputLabel: string
  /** "preciso de [N] [inputLabel]" */
  inputLabel: string
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number
  disabled?: boolean
}

// Inline composite control: "Para cada 1 X, preciso de [N] Y"
export function RatioInput({
  outputLabel,
  inputLabel,
  value,
  onChange,
  min = 0.01,
  step = 0.05,
  disabled,
}: RatioInputProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 text-sm leading-snug',
        'rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5',
        'transition-colors hover:border-border/60'
      )}
    >
      <span className="text-muted-foreground">Para cada</span>
      <span className="font-semibold text-foreground">1 {outputLabel}</span>
      <span className="text-muted-foreground">, preciso de</span>
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => {
          const next = parseFloat(e.target.value)
          onChange(Number.isFinite(next) ? next : 0)
        }}
        disabled={disabled}
        className="h-8 w-20 text-center font-medium"
      />
      <span className="text-muted-foreground">{inputLabel}</span>
    </div>
  )
}
