'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Map as MLMap, Marker as MLMarker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapPin, Search, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
import { useDebounce } from '@/hooks/use-debounce'

interface EventLocationPickerProps {
  location: string | null | undefined
  latitude: number | null | undefined
  longitude: number | null | undefined
  onChange: (next: {
    location: string | null
    latitude: number | null
    longitude: number | null
  }) => void
}

interface GeocodeResult {
  id: string
  label: string
  lat: number
  lng: number
}

const DEFAULT_CENTER: [number, number] = [-9.15, 38.72] // Lisboa
const DEFAULT_ZOOM = 6
const PIN_ZOOM = 16

// Free OSM raster tile style — no API key required. Attribution rendered by MapLibre.
const RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
} as const

export function EventLocationPicker({
  location,
  latitude,
  longitude,
  onChange,
}: EventLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markerRef = useRef<MLMarker | null>(null)

  const [query, setQuery] = useState(location ?? '')
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([])
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasUserTyped, setHasUserTyped] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  const debouncedQuery = useDebounce(query, 300)

  // Track latest values to use inside event handlers without resubscribing.
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  // Sync external `location` → input text (e.g. when editing an existing event).
  useEffect(() => {
    setQuery(location ?? '')
  }, [location])

  // -------------------- Map init (once) --------------------

  useEffect(() => {
    if (!mapContainerRef.current) return

    let map: MLMap
    let marker: MLMarker

    const init = async () => {
      const maplibregl = (await import('maplibre-gl')).default
      const hasCoords =
        latitude !== null && latitude !== undefined &&
        longitude !== null && longitude !== undefined

      map = new maplibregl.Map({
        container: mapContainerRef.current!,
        style: RASTER_STYLE as any,
        center: hasCoords ? [longitude!, latitude!] : DEFAULT_CENTER,
        zoom: hasCoords ? PIN_ZOOM : DEFAULT_ZOOM,
        attributionControl: { compact: true },
      })

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

      marker = new maplibregl.Marker({ draggable: true, color: '#3b82f6' })
        .setLngLat(hasCoords ? [longitude!, latitude!] : DEFAULT_CENTER)
        .addTo(map)

      // Hide marker if no coords yet — it's only meaningful when pinned.
      if (!hasCoords) marker.getElement().style.opacity = '0'

      marker.on('dragend', async () => {
        const { lat, lng } = marker.getLngLat()
        await reverseGeocode(lng, lat)
      })

      // Click on map → move pin there.
      map.on('click', async (e) => {
        const { lng, lat } = e.lngLat
        marker.setLngLat([lng, lat])
        marker.getElement().style.opacity = '1'
        await reverseGeocode(lng, lat)
      })

      map.on('load', () => setMapReady(true))

      mapRef.current = map
      markerRef.current = marker
    }

    init()

    return () => {
      try { map?.remove() } catch {}
      mapRef.current = null
      markerRef.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external lat/lng → marker position (handles edit-mode hydration).
  useEffect(() => {
    const m = markerRef.current
    const map = mapRef.current
    if (!m || !map) return
    const hasCoords =
      latitude !== null && latitude !== undefined &&
      longitude !== null && longitude !== undefined
    if (hasCoords) {
      m.setLngLat([longitude!, latitude!])
      m.getElement().style.opacity = '1'
      // Centre only if marker drifted off-screen (avoid flying on every keystroke).
      const bounds = map.getBounds()
      if (!bounds.contains([longitude!, latitude!])) {
        map.flyTo({ center: [longitude!, latitude!], zoom: PIN_ZOOM, duration: 800 })
      }
    } else {
      m.getElement().style.opacity = '0'
    }
  }, [latitude, longitude])

  // -------------------- Forward geocode (autocomplete) --------------------

  useEffect(() => {
    if (!hasUserTyped || debouncedQuery.length < 2) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/calendar/geocode?q=${encodeURIComponent(debouncedQuery)}`)
        const data = await res.json()
        if (cancelled) return
        const rows: GeocodeResult[] = data.results ?? []
        setSuggestions(rows)
        if (rows.length > 0) setPopoverOpen(true)
      } catch {
        if (!cancelled) setSuggestions([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [debouncedQuery, hasUserTyped])

  // -------------------- Reverse geocode (marker drag / map click) --------------------

  const reverseGeocode = useCallback(async (lng: number, lat: number) => {
    try {
      const res = await fetch(`/api/calendar/geocode?lat=${lat}&lng=${lng}`)
      const data = await res.json()
      const result = data.result as GeocodeResult | null
      const label = result?.label ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      setQuery(label)
      setHasUserTyped(false)
      setPopoverOpen(false)
      onChangeRef.current({ location: label, latitude: lat, longitude: lng })
    } catch {
      // Fall back to raw coords if reverse lookup fails.
      const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      setQuery(label)
      onChangeRef.current({ location: label, latitude: lat, longitude: lng })
    }
  }, [])

  // -------------------- Handlers --------------------

  const onSelectSuggestion = useCallback((s: GeocodeResult) => {
    setQuery(s.label)
    setHasUserTyped(false)
    setSuggestions([])
    setPopoverOpen(false)

    onChangeRef.current({ location: s.label, latitude: s.lat, longitude: s.lng })

    const map = mapRef.current
    const marker = markerRef.current
    if (map && marker) {
      marker.setLngLat([s.lng, s.lat])
      marker.getElement().style.opacity = '1'
      map.flyTo({ center: [s.lng, s.lat], zoom: PIN_ZOOM, duration: 1200 })
    }
  }, [])

  const onInput = useCallback((value: string) => {
    setHasUserTyped(true)
    setQuery(value)
    // Free-text typing keeps the textual location but does NOT clear coords —
    // user might have a pinned spot and just want to relabel it. Clearing happens
    // explicitly via the X button.
    onChangeRef.current({
      location: value === '' ? null : value,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    })
    if (value.length < 2) {
      setSuggestions([])
      setPopoverOpen(false)
    }
  }, [latitude, longitude])

  const clearAll = useCallback(() => {
    setQuery('')
    setSuggestions([])
    setPopoverOpen(false)
    setHasUserTyped(false)
    onChangeRef.current({ location: null, latitude: null, longitude: null })
    const marker = markerRef.current
    if (marker) marker.getElement().style.opacity = '0'
  }, [])

  const hasPin = latitude !== null && latitude !== undefined &&
                 longitude !== null && longitude !== undefined

  return (
    <div className="space-y-2">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            {isLoading && (
              <Loader2 className="absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            <Input
              value={query}
              onChange={(e) => onInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setPopoverOpen(true)}
              placeholder="Pesquisar morada ou escreva (ex: Online, Sala 2)"
              autoComplete="off"
              className="pl-8 pr-9 rounded-xl"
            />
            {(query || hasPin) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-muted-foreground"
                onClick={clearAll}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          sideOffset={4}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              <CommandEmpty>
                {isLoading ? 'A pesquisar...' : 'Sem resultados.'}
              </CommandEmpty>
              <CommandGroup>
                {suggestions.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.id}
                    onSelect={() => onSelectSuggestion(s)}
                    className="cursor-pointer gap-2"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs">{s.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="relative overflow-hidden rounded-xl border border-border/40">
        <div ref={mapContainerRef} className="h-[220px] w-full" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/40 backdrop-blur-sm">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Clique no mapa ou arraste o marcador para fixar a localização. A morada é
        actualizada automaticamente. Pode também escrever livremente (ex: "Online").
      </p>
    </div>
  )
}
