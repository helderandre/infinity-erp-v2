'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { UserCircle, Building2, Loader2 } from 'lucide-react'
import type { OwnerRow } from '@/types/owner'

interface OwnerSearchProps {
  onSelect: (owner: OwnerRow) => void
  placeholder?: string
  excludeIds?: string[]
}

export function OwnerSearch({
  onSelect,
  placeholder = 'Pesquisar proprietário por nome, NIF ou email...',
  excludeIds = [],
}: OwnerSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OwnerRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const debouncedQuery = useDebounce(query, 300)

  const search = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/owners?search=${encodeURIComponent(term)}&limit=10`
      )
      if (res.ok) {
        const data = await res.json()
        setResults(data.data || data || [])
      }
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    search(debouncedQuery)
  }, [debouncedQuery, search])

  const filtered = results.filter((o) => !excludeIds.includes(o.id))

  const handleSelect = (owner: OwnerRow) => {
    setQuery('')
    setResults([])
    setPopoverOpen(false)
    onSelect(owner)
  }

  return (
    <Popover open={popoverOpen && (filtered.length > 0 || isLoading || debouncedQuery.length >= 2)} onOpenChange={setPopoverOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (e.target.value.length >= 2) setPopoverOpen(true)
            }}
            onFocus={() => {
              if (filtered.length > 0) setPopoverOpen(true)
            }}
            placeholder={placeholder}
            autoComplete="off"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        sideOffset={4}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandList>
            <CommandEmpty>
              {isLoading
                ? 'A pesquisar...'
                : 'Nenhum proprietário encontrado.'}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((owner) => (
                <CommandItem
                  key={owner.id}
                  value={`${owner.name} ${owner.nif || ''}`}
                  onSelect={() => handleSelect(owner)}
                >
                  {owner.person_type === 'coletiva' ? (
                    <Building2 className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <UserCircle className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{owner.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {[owner.nif, owner.email, owner.phone]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
