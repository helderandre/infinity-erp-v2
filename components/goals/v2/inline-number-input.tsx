'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface InlineNumberInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Static suffix glued to the right of the input (e.g. "%", "ª") */
  suffix?: string
  /** Tailwind width class. Default w-16. */
  width?: string
  disabled?: boolean
}

// Editable number that lives inline inside prose. Maintains an internal draft
// string so an empty input stays visually empty (instead of snapping back to
// "0") while still propagating `0` to the parent for downstream calculations.
export function InlineNumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  width = 'w-16',
  disabled,
}: InlineNumberInputProps) {
  const [draft, setDraft] = useState<string>(() =>
    Number.isFinite(value) ? String(value) : ''
  )

  // If the parent value changes externally (e.g. another input flipped this
  // one — split toggles do this), reconcile the draft. Empty draft maps to 0
  // for the comparison so we don't clobber the user's empty field.
  useEffect(() => {
    const parsed = draft.trim() === '' ? 0 : parseFloat(draft)
    if (Number.isFinite(value) && parsed !== value) {
      setDraft(String(value))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <span className="inline-flex items-baseline align-baseline">
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          const parsed = parseFloat(next)
          onChange(Number.isFinite(parsed) ? parsed : 0)
        }}
        disabled={disabled}
        className={cn(
          'inline-flex h-7 px-2 text-center font-semibold align-baseline rounded-lg border-border/40 bg-background/60 backdrop-blur-sm',
          width
        )}
      />
      {suffix && (
        <span className="ml-0.5 font-semibold text-foreground">{suffix}</span>
      )}
    </span>
  )
}

// Helpers to convert between stored "inputs per 1 output" ratios and
// "% of inputs that convert" percentages. Symmetric.
//   stored ratio R means 1 output requires R inputs → success rate = 1/R = pct/100
//   pct P means P/100 inputs convert → R = 100/P
export function ratioToPct(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0
  return Math.round((100 / ratio) * 10) / 10
}

export function pctToRatio(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0
  return 100 / pct
}
