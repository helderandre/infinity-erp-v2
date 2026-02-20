'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MapPin, Search, Building2, MapPinned, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

// --- Types ---

interface MapboxSuggestion {
  mapbox_id: string
  name: string
  full_address?: string
  place_formatted?: string
  feature_type: string
  context?: {
    postcode?: { name: string }
    place?: { name: string }
    locality?: { name: string }
    region?: { name: string }
    district?: { name: string }
    country?: { name: string }
  }
}

interface AddressMapPickerProps {
  address?: string
  postalCode?: string
  city?: string
  zone?: string
  latitude?: number | null
  longitude?: number | null
  onAddressChange: (value: string) => void
  onPostalCodeChange: (value: string) => void
  onCityChange: (value: string) => void
  onZoneChange: (value: string) => void
  onLatitudeChange: (value: number | null) => void
  onLongitudeChange: (value: number | null) => void
}

// --- Helpers ---

function getFeatureIcon(featureType: string) {
  switch (featureType) {
    case 'address':
    case 'street':
      return <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
    case 'poi':
      return <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
    default:
      return <MapPinned className="h-4 w-4 shrink-0 text-muted-foreground" />
  }
}

// --- Component ---

export function PropertyAddressMapPicker({
  address = '',
  postalCode = '',
  city = '',
  zone = '',
  latitude = null,
  longitude = null,
  onAddressChange,
  onPostalCodeChange,
  onCityChange,
  onZoneChange,
  onLatitudeChange,
  onLongitudeChange,
}: AddressMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  const [query, setQuery] = useState(address)
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([])
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID())
  const [mapReady, setMapReady] = useState(false)

  const debouncedQuery = useDebounce(query, 300)

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ''

  // Sync external address prop to local query
  useEffect(() => {
    setQuery(address)
  }, [address])

  // Generate new session token
  const newSession = useCallback(() => {
    setSessionToken(crypto.randomUUID())
  }, [])

  // --- Map Initialization ---

  useEffect(() => {
    if (!mapContainerRef.current || !token) return

    let map: mapboxgl.Map
    let marker: mapboxgl.Marker

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = token

      const hasCoords =
        latitude !== null &&
        latitude !== undefined &&
        longitude !== null &&
        longitude !== undefined

      map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: hasCoords ? [longitude!, latitude!] : [-9.15, 38.72],
        zoom: hasCoords ? 15 : 10,
      })

      marker = new mapboxgl.Marker({
        draggable: true,
        color: '#3b82f6',
      })
        .setLngLat(hasCoords ? [longitude!, latitude!] : [-9.15, 38.72])
        .addTo(map)

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat()
        onLatitudeChange(lngLat.lat)
        onLongitudeChange(lngLat.lng)
        reverseGeocode(lngLat.lng, lngLat.lat)
      })

      mapRef.current = map
      markerRef.current = marker

      map.on('load', () => {
        setMapReady(true)
      })
    }

    initMap()

    return () => {
      if (map) map.remove()
      mapRef.current = null
      markerRef.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // --- Fetch Suggestions (Suggest API) ---

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([])
      return
    }

    const fetchSuggestions = async () => {
      setIsLoading(true)
      try {
        const center = mapRef.current?.getCenter()
        const proximityParam = center
          ? `&proximity=${center.lng},${center.lat}`
          : '&proximity=-9.15,38.72'

        const url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(debouncedQuery)}&access_token=${token}&language=pt&country=PT&session_token=${sessionToken}${proximityParam}&limit=5`

        const res = await fetch(url)
        const data = await res.json()

        if (data.suggestions) {
          setSuggestions(data.suggestions)
          if (data.suggestions.length > 0) {
            setPopoverOpen(true)
          }
        }
      } catch (err) {
        console.error('Erro ao pesquisar moradas:', err)
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchSuggestions()
  }, [debouncedQuery, token, sessionToken])

  // --- Select Suggestion (Retrieve API) ---

  const onSelectSuggestion = useCallback(
    async (suggestion: MapboxSuggestion) => {
      // Fill address from suggestion
      onAddressChange(suggestion.full_address || suggestion.name)
      setQuery(suggestion.full_address || suggestion.name)

      // Fill context fields
      if (suggestion.context?.postcode?.name) {
        onPostalCodeChange(suggestion.context.postcode.name)
      }
      if (suggestion.context?.place?.name || suggestion.context?.locality?.name) {
        onCityChange(
          suggestion.context.place?.name ||
            suggestion.context.locality?.name ||
            ''
        )
      }
      if (suggestion.context?.region?.name || suggestion.context?.district?.name) {
        onZoneChange(
          suggestion.context.region?.name ||
            suggestion.context.district?.name ||
            ''
        )
      }

      setPopoverOpen(false)
      setSuggestions([])

      // Retrieve full details with coordinates
      try {
        const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}?access_token=${token}&session_token=${sessionToken}&language=pt`
        const res = await fetch(url)
        const data = await res.json()

        if (data.features && data.features.length > 0) {
          const feature = data.features[0]
          const [lng, lat] = feature.geometry.coordinates

          onLatitudeChange(lat)
          onLongitudeChange(lng)

          // Update address with full retrieved address if available
          if (feature.properties?.full_address) {
            onAddressChange(feature.properties.full_address)
            setQuery(feature.properties.full_address)
          }

          // Update context from retrieve if available
          const ctx = feature.properties?.context
          if (ctx) {
            if (ctx.postcode?.name) onPostalCodeChange(ctx.postcode.name)
            if (ctx.place?.name || ctx.locality?.name) {
              onCityChange(ctx.place?.name || ctx.locality?.name || '')
            }
            if (ctx.region?.name || ctx.district?.name) {
              onZoneChange(ctx.region?.name || ctx.district?.name || '')
            }
          }

          // Move marker and fly to location
          if (markerRef.current && mapRef.current) {
            markerRef.current.setLngLat([lng, lat])
            mapRef.current.flyTo({
              center: [lng, lat],
              zoom: 16,
              duration: 1500,
            })
          }
        }
      } catch (err) {
        console.error('Erro ao obter detalhes da morada:', err)
      }

      // New session for next search
      newSession()
    },
    [
      token,
      sessionToken,
      newSession,
      onAddressChange,
      onPostalCodeChange,
      onCityChange,
      onZoneChange,
      onLatitudeChange,
      onLongitudeChange,
    ]
  )

  // --- Reverse Geocode (Geocoding API v5) ---

  const reverseGeocode = useCallback(
    async (lng: number, lat: number) => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=pt&limit=5`
        const res = await fetch(url)
        const data = await res.json()

        if (data.features && data.features.length > 0) {
          // Find the most specific address feature
          const addressFeature = data.features.find(
            (f: any) => f.place_type?.includes('address')
          )
          const feature = addressFeature || data.features[0]

          if (feature.place_name) {
            onAddressChange(feature.place_name)
            setQuery(feature.place_name)
          }

          // Extract context fields
          const context = feature.context || []
          for (const ctx of context) {
            const id = ctx.id || ''
            if (id.startsWith('postcode')) {
              onPostalCodeChange(ctx.text)
            } else if (id.startsWith('place') || id.startsWith('locality')) {
              onCityChange(ctx.text)
            } else if (id.startsWith('region') || id.startsWith('district')) {
              onZoneChange(ctx.text)
            }
          }
        }
      } catch (err) {
        console.error('Erro na geocodificação inversa:', err)
      }
    },
    [token, onAddressChange, onPostalCodeChange, onCityChange, onZoneChange]
  )

  // --- Input Handler ---

  const onInput = useCallback(
    (value: string) => {
      setQuery(value)
      onAddressChange(value)
      if (value.length < 2) {
        setSuggestions([])
        setPopoverOpen(false)
      }
    },
    [onAddressChange]
  )

  return (
    <div className="space-y-4">
      {/* Autocomplete Search */}
      <div className="space-y-2">
        <Label htmlFor="address-map-search">Morada exata</Label>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverAnchor asChild>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              {isLoading && (
                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
              )}
              <Input
                id="address-map-search"
                value={query}
                onChange={(e) => onInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setPopoverOpen(true)}
                placeholder="Pesquisar morada..."
                autoComplete="off"
                className="pl-8"
              />
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
                      key={s.mapbox_id}
                      value={s.mapbox_id}
                      onSelect={() => onSelectSuggestion(s)}
                      className="cursor-pointer"
                    >
                      {getFeatureIcon(s.feature_type)}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{s.name}</span>
                        {s.full_address && (
                          <span className="text-xs text-muted-foreground truncate">
                            {s.full_address}
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
      </div>

      {/* Map Container */}
      <div className="relative rounded-lg border overflow-hidden">
        <div
          ref={mapContainerRef}
          className="h-[350px] w-full"
        />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              A carregar mapa...
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Arraste o marcador no mapa para ajustar a localização exacta. A morada
        será actualizada automaticamente.
      </p>
    </div>
  )
}
