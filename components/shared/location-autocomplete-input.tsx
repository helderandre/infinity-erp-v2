'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Popover, PopoverAnchor, PopoverContent,
} from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandItem, CommandList,
} from '@/components/ui/command'
import { useDebounce } from '@/hooks/use-debounce'

interface MapboxSuggestion {
  mapbox_id: string
  name: string
  full_address?: string
  place_formatted?: string
  feature_type?: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /** Se true (default), seleccionar adiciona à lista CSV (ex.: "Lisboa, Cascais"). */
  multi?: boolean
}

/**
 * Input com autocomplete Mapbox para localizações (regiões, distritos,
 * concelhos, freguesias, código postal) restringido a PT. Não tem mapa nem
 * geocoding inverso — só sugestões textuais ligadas aos campos de
 * localização dos negócios. Em modo `multi` (default) a selecção substitui
 * apenas o último segmento separado por vírgula, permitindo "Lisboa,
 * Cascais, Oeiras".
 */
export function LocationAutocompleteInput({
  value,
  onChange,
  placeholder = 'ex: Lisboa, Cascais...',
  className,
  multi = true,
}: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([])
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID())
  const debouncedQuery = useDebounce(query, 300)
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ''

  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2 || !token) {
      setSuggestions([])
      return
    }
    let cancelled = false
    setIsLoading(true)
    const url = new URL('https://api.mapbox.com/search/searchbox/v1/suggest')
    url.searchParams.set('q', debouncedQuery)
    url.searchParams.set('access_token', token)
    url.searchParams.set('language', 'pt')
    url.searchParams.set('country', 'PT')
    url.searchParams.set('session_token', sessionToken)
    url.searchParams.set('types', 'region,district,place,locality,neighborhood,postcode')
    url.searchParams.set('limit', '6')

    fetch(url.toString())
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((data) => {
        if (cancelled) return
        const list: MapboxSuggestion[] = data.suggestions || []
        setSuggestions(list)
        if (list.length > 0) setPopoverOpen(true)
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, token, sessionToken])

  const onSelectSuggestion = (s: MapboxSuggestion) => {
    if (multi) {
      const parts = value
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
      const lastPart = parts[parts.length - 1] || ''
      if (
        lastPart &&
        query &&
        lastPart.toLowerCase().startsWith(query.toLowerCase().slice(0, 2))
      ) {
        parts[parts.length - 1] = s.name
      } else {
        parts.push(s.name)
      }
      onChange(parts.join(', '))
    } else {
      onChange(s.name)
    }
    setQuery('')
    // Clear suggestions imediatamente — caso contrário, quando o input
    // recebe foco de volta e onFocus dispara, suggestions ainda contém a
    // lista antiga e a popover reabre antes do debounce ter limpado tudo.
    setSuggestions([])
    setPopoverOpen(false)
    setSessionToken(crypto.randomUUID())
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    onChange(v)
    const lastSeg = v.split(',').pop()?.trim() || ''
    setQuery(lastSeg)
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverAnchor asChild>
        <Input
          value={value}
          onChange={onInputChange}
          placeholder={placeholder}
          className={className}
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
            <CommandEmpty>{isLoading ? 'A pesquisar...' : 'Sem resultados.'}</CommandEmpty>
            <CommandGroup>
              {suggestions.map((s) => (
                <CommandItem
                  key={s.mapbox_id}
                  value={s.full_address || s.name}
                  onSelect={() => onSelectSuggestion(s)}
                >
                  <MapPin className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{s.name}</span>
                  {s.place_formatted && s.place_formatted !== s.name && (
                    <span className="ml-2 text-xs text-muted-foreground truncate">
                      {s.place_formatted}
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
