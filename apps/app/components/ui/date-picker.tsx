'use client'

import * as React from 'react'
import { format, parse, isValid } from 'date-fns'
import { pt } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DatePickerProps {
  value?: string // ISO date string (YYYY-MM-DD) or empty
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar data...',
  disabled,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Parse ISO string to Date
  const date = React.useMemo(() => {
    if (!value) return undefined
    const parsed = parse(value, 'yyyy-MM-dd', new Date())
    return isValid(parsed) ? parsed : undefined
  }, [value])

  const handleSelect = (selected: Date | undefined) => {
    if (selected) {
      onChange?.(format(selected, 'yyyy-MM-dd'))
    } else {
      onChange?.('')
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal h-9',
            !date && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'dd/MM/yyyy', { locale: pt }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          locale={pt}
          captionLayout="dropdown"
          defaultMonth={date}
          fromYear={1920}
          toYear={2040}
        />
      </PopoverContent>
    </Popover>
  )
}
