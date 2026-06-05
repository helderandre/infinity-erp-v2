'use client'

import { Check, ChevronsUpDown, User, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useState } from 'react'
import type { ProcessOwner } from '@/types/process'

interface OwnerSelectorProps {
  owners: ProcessOwner[]
  selectedOwnerIds: string[]
  onChange: (ids: string[]) => void
  multiple?: boolean
  placeholder?: string
}

export function OwnerSelector({
  owners,
  selectedOwnerIds,
  onChange,
  multiple = false,
  placeholder = 'Seleccionar proprietário...',
}: OwnerSelectorProps) {
  const [open, setOpen] = useState(false)

  const selectedOwners = owners.filter(o => selectedOwnerIds.includes(o.id))

  const handleSelect = (ownerId: string) => {
    if (multiple) {
      if (selectedOwnerIds.includes(ownerId)) {
        onChange(selectedOwnerIds.filter(id => id !== ownerId))
      } else {
        onChange([...selectedOwnerIds, ownerId])
      }
    } else {
      if (selectedOwnerIds.includes(ownerId)) {
        onChange([])
      } else {
        onChange([ownerId])
      }
      setOpen(false)
    }
  }

  const displayLabel = selectedOwners.length === 0
    ? placeholder
    : selectedOwners.length === 1
      ? selectedOwners[0].name
      : `${selectedOwners.length} proprietários`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Pesquisar proprietário..." />
          <CommandList>
            <CommandEmpty>Sem proprietários encontrados.</CommandEmpty>
            <CommandGroup>
              {owners.map((owner) => (
                <CommandItem
                  key={owner.id}
                  value={owner.name}
                  onSelect={() => handleSelect(owner.id)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedOwnerIds.includes(owner.id) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {owner.person_type === 'singular' ? (
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{owner.name}</span>
                    <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                      {owner.person_type === 'singular' ? 'Singular' : 'Colectiva'}
                    </Badge>
                  </div>
                  {owner.nif && (
                    <span className="ml-2 text-xs text-muted-foreground shrink-0">
                      {owner.nif}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
