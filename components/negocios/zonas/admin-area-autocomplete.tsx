'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { MapPin, Building2, Map as MapIcon, Loader2 } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import type { AdminAreaSearchResult, AdminAreaType } from '@/lib/matching'

interface AdminAreaAutocompleteProps {
  onSelect: (result: AdminAreaSearchResult) => void
  /** Filtra por tipos. Default: todos. */
  types?: AdminAreaType[]
  placeholder?: string
  /** Áreas já seleccionadas (escondidas da lista) */
  excludeIds?: string[]
}

const TYPE_ICONS: Record<AdminAreaType, React.ElementType> = {
  distrito: MapIcon,
  concelho: Building2,
  freguesia: MapPin,
}

const TYPE_LABELS: Record<AdminAreaType, string> = {
  distrito: 'Distrito',
  concelho: 'Concelho',
  freguesia: 'Freguesia',
}

export function AdminAreaAutocomplete({
  onSelect,
  types,
  placeholder = 'Pesquisar distrito, concelho ou freguesia...',
  excludeIds = [],
}: AdminAreaAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminAreaSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 250)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([])
      setIsLoading(false)
      return
    }
    const ctrl = new AbortController()
    setIsLoading(true)
    const params = new URLSearchParams({ q: debouncedQuery, limit: '10' })
    if (types && types.length > 0) params.set('types', types.join(','))

    fetch(`/api/admin-areas/search?${params}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((json) => {
        setResults(json.data ?? [])
      })
      .catch(() => {
        setResults([])
      })
      .finally(() => setIsLoading(false))

    return () => ctrl.abort()
  }, [debouncedQuery, types])

  const visible = results.filter((r) => !excludeIds.includes(r.id))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => visible.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        sideOffset={4}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />A pesquisar...
                </span>
              ) : query.trim().length < 2 ? (
                'Escreva pelo menos 2 letras...'
              ) : (
                'Sem resultados.'
              )}
            </CommandEmpty>
            {visible.length > 0 && (
              <CommandGroup>
                {visible.map((r) => {
                  const Icon = TYPE_ICONS[r.type]
                  return (
                    <CommandItem
                      key={r.id}
                      value={`${r.name}-${r.id}`}
                      onSelect={() => {
                        onSelect(r)
                        setQuery('')
                        setResults([])
                        setOpen(false)
                        // re-focus para selecções consecutivas
                        setTimeout(() => inputRef.current?.focus(), 0)
                      }}
                    >
                      <Icon className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {TYPE_LABELS[r.type]}
                        {r.parent_label ? ` · ${r.parent_label}` : ''}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
