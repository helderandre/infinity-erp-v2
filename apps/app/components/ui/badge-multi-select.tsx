'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface BadgeMultiSelectOption {
  value: string
  label: string
}

interface BadgeMultiSelectProps {
  options: BadgeMultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  allowCustom?: boolean
  customPlaceholder?: string
  disabled?: boolean
  className?: string
}

export function BadgeMultiSelect({
  options,
  value,
  onChange,
  allowCustom = true,
  customPlaceholder = 'Novo valor...',
  disabled,
  className,
}: BadgeMultiSelectProps) {
  const [adding, setAdding] = useState(false)
  const [customValue, setCustomValue] = useState('')

  const toggle = (val: string) => {
    if (disabled) return
    const next = value.includes(val)
      ? value.filter(v => v !== val)
      : [...value, val]
    onChange(next)
  }

  const customItems = value.filter(v => !options.some(o => o.value === v))

  const addCustom = () => {
    const trimmed = customValue.trim()
    if (!trimmed || value.includes(trimmed)) return
    onChange([...value, trimmed])
    setCustomValue('')
    setAdding(false)
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map(opt => {
        const isSelected = value.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            disabled={disabled}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
              isSelected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:bg-muted hover:text-foreground',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {opt.label}
            {isSelected && <X className="h-3 w-3 ml-0.5" />}
          </button>
        )
      })}

      {customItems.map(v => (
        <button
          key={v}
          type="button"
          onClick={() => toggle(v)}
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground border-primary cursor-pointer transition-colors',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {v}
          <X className="h-3 w-3 ml-0.5" />
        </button>
      ))}

      {allowCustom && !disabled && (
        adding ? (
          <div className="inline-flex items-center gap-1">
            <Input
              autoFocus
              value={customValue}
              onChange={e => setCustomValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addCustom() }
                if (e.key === 'Escape') { setAdding(false); setCustomValue('') }
              }}
              onBlur={() => { if (customValue.trim()) addCustom(); else setAdding(false) }}
              className="h-7 w-32 text-xs"
              placeholder={customPlaceholder}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            Adicionar
          </button>
        )
      )}
    </div>
  )
}
