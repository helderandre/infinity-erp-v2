'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

interface PaymentStatusDotProps {
  checked: boolean
  date?: string | null
  label: string
  editable?: boolean
  onToggle?: (date: string) => void
}

export function PaymentStatusDot({ checked, date, label, editable = false, onToggle }: PaymentStatusDotProps) {
  const [dateValue, setDateValue] = useState(date || new Date().toISOString().split('T')[0])
  const [open, setOpen] = useState(false)

  if (!editable) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          className={cn(
            'h-5 w-5 rounded-full flex items-center justify-center transition-all duration-300',
            checked
              ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
              : 'border-2 border-muted-foreground/30'
          )}
          title={checked && date ? `${label}: ${new Date(date).toLocaleDateString('pt-PT')}` : label}
        >
          {checked && <Check className="h-3 w-3 text-white" />}
        </div>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-center gap-1 group"
        >
          <div
            className={cn(
              'h-5 w-5 rounded-full flex items-center justify-center transition-all duration-300',
              checked
                ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
                : 'border-2 border-muted-foreground/30 group-hover:border-primary/50'
            )}
          >
            {checked && <Check className="h-3 w-3 text-white" />}
          </div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
        </button>
      </PopoverTrigger>
      {!checked && (
        <PopoverContent className="w-56 p-3" align="center">
          <div className="space-y-2">
            <Label className="text-xs">Data de {label}</Label>
            <Input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              className="w-full rounded-full text-xs"
              onClick={() => {
                onToggle?.(dateValue)
                setOpen(false)
              }}
            >
              Confirmar
            </Button>
          </div>
        </PopoverContent>
      )}
    </Popover>
  )
}
