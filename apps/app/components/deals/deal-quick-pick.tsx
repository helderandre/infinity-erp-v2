'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { AcqFieldWrapper, AcqFieldLabel } from '@/components/acquisitions/acquisition-field'

interface DealQuickPickProps {
  label: string
  value: number | string | undefined
  onChange: (value: string) => void
  quickPicks: { value: number; label: string }[]
  suffix?: string
  placeholder?: string
  hint?: string
  required?: boolean
  error?: string
}

export function DealQuickPick({
  label,
  value,
  onChange,
  quickPicks,
  suffix = '%',
  placeholder = '',
  hint,
  required,
  error,
}: DealQuickPickProps) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value

  return (
    <AcqFieldWrapper className={cn(error && 'border-destructive')}>
      <AcqFieldLabel required={required}>{label}</AcqFieldLabel>

      <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
        {quickPicks.map((qp) => (
          <button
            key={qp.value}
            type="button"
            onClick={() => onChange(String(qp.value))}
            className={cn(
              'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
              numValue === qp.value
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-border hover:bg-accent'
            )}
          >
            {qp.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Outra'}
          className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium pr-6"
        />
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>

      {hint && (
        <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>
      )}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </AcqFieldWrapper>
  )
}
