'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { PlusCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
  dot?: string
  color?: string
}

interface MultiSelectFilterProps {
  title: string
  options: MultiSelectOption[]
  selected: string[]
  onSelectedChange: (selected: string[]) => void
  searchable?: boolean
  maxBadges?: number
}

export function MultiSelectFilter({
  title,
  options,
  selected,
  onSelectedChange,
  searchable = false,
  maxBadges = 2,
}: MultiSelectFilterProps) {
  const allKeys = options.map((o) => o.value)
  const isAllSelected = selected.length === allKeys.length
  const hasFilter = selected.length > 0 && selected.length < allKeys.length
  const noneSelected = selected.length === 0

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onSelectedChange(selected.filter((s) => s !== value))
    } else {
      onSelectedChange([...selected, value])
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {hasFilter && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <div className="flex gap-1">
                {selected.length > maxBadges ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selected.length} seleccionados
                  </Badge>
                ) : (
                  selected.map((val) => {
                    const opt = options.find((o) => o.value === val)
                    return (
                      <Badge key={val} variant="secondary" className="rounded-sm px-1 font-normal">
                        {opt?.label || val}
                      </Badge>
                    )
                  })
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder={title} />}
          <CommandList>
            <CommandEmpty>Sem resultados.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selected.includes(opt.value)
                return (
                  <CommandItem key={opt.value} onSelect={() => toggle(opt.value)}>
                    <div
                      className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </div>
                    {opt.dot && (
                      <span className={cn('mr-2 h-2 w-2 rounded-full shrink-0', opt.dot)} />
                    )}
                    <span className={opt.color}>{opt.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {!isAllSelected && (
                <CommandItem
                  onSelect={() => onSelectedChange([...allKeys])}
                  className="justify-center text-center"
                >
                  Seleccionar todos
                </CommandItem>
              )}
              {(hasFilter || isAllSelected) && (
                <CommandItem
                  onSelect={() => onSelectedChange([])}
                  className="justify-center text-center"
                >
                  Limpar filtros
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
