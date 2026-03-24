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
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EntityOption {
  id: string
  label: string
  detail?: string
}

interface EntitySearchInputProps {
  value: string
  onChange: (id: string) => void
  placeholder?: string
  entityType: 'property' | 'owner' | 'consultant'
}

async function searchEntities(
  type: EntitySearchInputProps['entityType'],
  term: string
): Promise<EntityOption[]> {
  if (term.length < 2) return []

  switch (type) {
    case 'property': {
      const res = await fetch(`/api/properties?search=${encodeURIComponent(term)}&per_page=8`)
      if (!res.ok) return []
      const json = await res.json()
      return (json.data || []).map((p: { id: string; title: string; external_ref?: string; city?: string }) => ({
        id: p.id,
        label: p.title || 'Sem título',
        detail: [p.external_ref, p.city].filter(Boolean).join(' · '),
      }))
    }
    case 'owner': {
      const res = await fetch(`/api/owners?search=${encodeURIComponent(term)}&limit=8`)
      if (!res.ok) return []
      const json = await res.json()
      return (json.data || []).map((o: { id: string; name: string; nif?: string; email?: string }) => ({
        id: o.id,
        label: o.name,
        detail: [o.nif, o.email].filter(Boolean).join(' · '),
      }))
    }
    case 'consultant': {
      const res = await fetch(`/api/consultants?search=${encodeURIComponent(term)}&per_page=8`)
      if (!res.ok) return []
      const json = await res.json()
      return (json.data || []).map((c: { id: string; commercial_name: string; professional_email?: string }) => ({
        id: c.id,
        label: c.commercial_name,
        detail: c.professional_email || undefined,
      }))
    }
  }
}

export function EntitySearchInput({
  value,
  onChange,
  placeholder = 'Pesquisar...',
  entityType,
}: EntitySearchInputProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EntityOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)

  const debouncedQuery = useDebounce(query, 300)

  const doSearch = useCallback(
    async (term: string) => {
      setIsLoading(true)
      try {
        const data = await searchEntities(entityType, term)
        setResults(data)
        if (data.length > 0) setPopoverOpen(true)
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    },
    [entityType]
  )

  useEffect(() => {
    if (debouncedQuery.length >= 2 && !selectedLabel) {
      doSearch(debouncedQuery)
    } else {
      setResults([])
    }
  }, [debouncedQuery, selectedLabel, doSearch])

  const handleSelect = (option: EntityOption) => {
    onChange(option.id)
    setSelectedLabel(option.label)
    setQuery('')
    setPopoverOpen(false)
    setResults([])
  }

  const handleClear = () => {
    onChange('')
    setSelectedLabel(null)
    setQuery('')
    setResults([])
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          {selectedLabel ? (
            <div className="flex items-center h-9 w-full rounded-md border border-input bg-muted/30 px-3 text-sm">
              <span className="flex-1 truncate">{selectedLabel}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0 ml-1"
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedLabel(null)
                  if (e.target.value.length >= 2) setPopoverOpen(true)
                }}
                onFocus={() => {
                  if (results.length > 0) setPopoverOpen(true)
                }}
                placeholder={placeholder}
                autoComplete="off"
              />
              {isLoading && (
                <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
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
              {isLoading ? 'A pesquisar...' : 'Sem resultados.'}
            </CommandEmpty>
            <CommandGroup>
              {results.map((r) => (
                <CommandItem
                  key={r.id}
                  value={r.id}
                  onSelect={() => handleSelect(r)}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{r.label}</span>
                    {r.detail && (
                      <span className="text-xs text-muted-foreground truncate">
                        {r.detail}
                      </span>
                    )}
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
