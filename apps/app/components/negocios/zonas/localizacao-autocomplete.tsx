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
import { MapPin, Building2, Map as MapIcon, Loader2, Milestone } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import type { AdminAreaSearchResult, AdminAreaType } from '@/lib/matching'

/**
 * Autocomplete de localização para a venda de um imóvel.
 *
 * Pesquisa DUAS fontes em paralelo e mostra-as agrupadas:
 *  - Zonas administrativas (distrito/concelho/freguesia) — `admin_areas` via
 *    /api/admin-areas/search (comportamento existente);
 *  - Moradas de rua — Mapbox SearchBox suggest (country=PT). Ao seleccionar
 *    uma rua, faz retrieve para obter coordenadas e chama /api/geo/reverse
 *    (geoapi.pt) para resolver distrito/concelho/freguesia exactos + match
 *    em admin_areas para o chip de zona.
 *
 * Se NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN não estiver definido, degrada para
 * pesquisa de zonas administrativas apenas.
 */

export interface MoradaSelection {
  /** Nome da rua (ex.: "Rua Jacob Queimado") */
  street: string
  /** Morada completa legível (ex.: "Rua Jacob Queimado, 2910 Setúbal, Portugal") */
  fullAddress: string
  latitude: number | null
  longitude: number | null
  distrito: string | null
  concelho: string | null
  freguesia: string | null
  /** Match em admin_areas (freguesia, fallback concelho) para `zonas` */
  area: { id: string; type: AdminAreaType; name: string; parent_label: string | null } | null
}

interface MapboxSuggestion {
  mapbox_id: string
  name: string
  full_address?: string
  place_formatted?: string
  feature_type?: string
  context?: {
    region?: { name?: string }
    place?: { name?: string }
  }
}

interface LocalizacaoAutocompleteProps {
  onSelectArea: (result: AdminAreaSearchResult) => void
  onSelectMorada: (morada: MoradaSelection) => void | Promise<void>
  placeholder?: string
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

export function LocalizacaoAutocomplete({
  onSelectArea,
  onSelectMorada,
  placeholder = 'Procurar rua, freguesia, concelho ou distrito...',
}: LocalizacaoAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [areas, setAreas] = useState<AdminAreaSearchResult[]>([])
  const [moradas, setMoradas] = useState<MapboxSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [open, setOpen] = useState(false)
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID())
  const debouncedQuery = useDebounce(query, 250)
  const inputRef = useRef<HTMLInputElement>(null)
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setAreas([])
      setMoradas([])
      setIsLoading(false)
      return
    }
    const ctrl = new AbortController()
    setIsLoading(true)

    const areasReq = fetch(
      `/api/admin-areas/search?${new URLSearchParams({ q: debouncedQuery, limit: '6' })}`,
      { signal: ctrl.signal },
    )
      .then((r) => r.json())
      .then((json) => (json.data ?? []) as AdminAreaSearchResult[])
      .catch(() => [] as AdminAreaSearchResult[])

    const moradasReq = mapboxToken
      ? fetch(
          `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(debouncedQuery)}&access_token=${mapboxToken}&language=pt&country=PT&types=address,street&session_token=${sessionToken}&limit=5`,
          { signal: ctrl.signal },
        )
          .then((r) => r.json())
          .then((json) => (json.suggestions ?? []) as MapboxSuggestion[])
          .catch(() => [] as MapboxSuggestion[])
      : Promise.resolve([] as MapboxSuggestion[])

    Promise.all([areasReq, moradasReq])
      .then(([a, m]) => {
        setAreas(a)
        setMoradas(m)
      })
      .finally(() => setIsLoading(false))

    return () => ctrl.abort()
  }, [debouncedQuery, mapboxToken, sessionToken])

  const reset = () => {
    setQuery('')
    setAreas([])
    setMoradas([])
    setOpen(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function handleSelectMorada(s: MapboxSuggestion) {
    setIsResolving(true)
    setOpen(false)
    try {
      let latitude: number | null = null
      let longitude: number | null = null
      let fullAddress = s.full_address || (s.place_formatted ? `${s.name}, ${s.place_formatted}` : s.name)

      if (mapboxToken) {
        try {
          const res = await fetch(
            `https://api.mapbox.com/search/searchbox/v1/retrieve/${s.mapbox_id}?access_token=${mapboxToken}&session_token=${sessionToken}&language=pt`,
          )
          if (res.ok) {
            const data = await res.json()
            const feature = data.features?.[0]
            const coords = feature?.geometry?.coordinates
            if (Array.isArray(coords) && coords.length >= 2) {
              longitude = coords[0]
              latitude = coords[1]
            }
            if (feature?.properties?.full_address) {
              fullAddress = feature.properties.full_address
            }
          }
        } catch {}
      }

      // Hierarquia exacta via geoapi.pt (o Mapbox não dá a freguesia).
      let distrito: string | null = s.context?.region?.name ?? null
      let concelho: string | null = s.context?.place?.name ?? null
      let freguesia: string | null = null
      let area: MoradaSelection['area'] = null

      if (latitude != null && longitude != null) {
        try {
          const res = await fetch(`/api/geo/reverse?lat=${latitude}&lng=${longitude}`)
          if (res.ok) {
            const h = await res.json()
            distrito = h.distrito ?? distrito
            concelho = h.concelho ?? concelho
            freguesia = h.freguesia ?? null
            area = h.area ?? null
          }
        } catch {}
      }

      await onSelectMorada({
        street: s.name,
        fullAddress,
        latitude,
        longitude,
        distrito,
        concelho,
        freguesia,
        area,
      })
    } finally {
      setIsResolving(false)
      // Sessão Mapbox fecha no retrieve — gerar nova para a próxima pesquisa.
      setSessionToken(crypto.randomUUID())
      reset()
    }
  }

  const hasResults = areas.length > 0 || moradas.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => hasResults && setOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            disabled={isResolving}
          />
          {isResolving && (
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
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />A pesquisar...
                </span>
              ) : query.trim().length < 2 ? (
                'Escreve pelo menos 2 letras...'
              ) : (
                'Sem resultados.'
              )}
            </CommandEmpty>
            {moradas.length > 0 && (
              <CommandGroup heading="Moradas">
                {moradas.map((s) => (
                  <CommandItem
                    key={s.mapbox_id}
                    value={`morada-${s.mapbox_id}`}
                    onSelect={() => handleSelectMorada(s)}
                  >
                    <Milestone className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-medium truncate">{s.name}</span>
                    {s.place_formatted && (
                      <span className="ml-auto pl-2 text-xs text-muted-foreground truncate">
                        {s.place_formatted}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {areas.length > 0 && (
              <CommandGroup heading="Zonas administrativas">
                {areas.map((r) => {
                  const Icon = TYPE_ICONS[r.type]
                  return (
                    <CommandItem
                      key={r.id}
                      value={`area-${r.id}`}
                      onSelect={() => {
                        onSelectArea(r)
                        reset()
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
