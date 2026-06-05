'use client'

import { cn } from '@/lib/utils'

interface DealToggleGroupProps {
  value: string | undefined
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  error?: string
}

export function DealToggleGroup({ value, onChange, options, error }: DealToggleGroupProps) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
              value === opt.value
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-border hover:bg-accent'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
    </div>
  )
}

interface DealYesNoProps {
  value: boolean | undefined
  onChange: (value: boolean) => void
  error?: string
}

export function DealYesNo({ value, onChange, error }: DealYesNoProps) {
  return (
    <DealToggleGroup
      value={value === true ? 'sim' : value === false ? 'nao' : undefined}
      onChange={(v) => onChange(v === 'sim')}
      options={[
        { value: 'sim', label: 'Sim' },
        { value: 'nao', label: 'Não' },
      ]}
      error={error}
    />
  )
}
