'use client'

/**
 * Full-screen experience to add zones to a negocio while seeing properties
 * that already match the negocio's other criteria. Replaces the small
 * <ZonasSheet> for buyer/tenant flows.
 *
 * Layout
 *   • Desktop: 340px sidebar (chips, autocomplete, property cards) +
 *     map filling the rest
 *   • Mobile: header on top, ~40dvh map, scrollable list of cards below
 *
 * Live updates
 *   • Each change to `zones` triggers POST /api/negocios/[id]/matches/preview
 *     and refreshes both the property list and the map markers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ArrowLeft, Pencil, Plus, X, MapPin, Building2, Map as MapIcon, Home, Bed, Maximize, Loader2, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn, formatCurrency } from '@/lib/utils'
import { AdminAreaAutocomplete } from './admin-area-autocomplete'
import { adminAreaLabel } from '@/lib/matching'
import type { AdminAreaSearchResult, NegocioZone } from '@/lib/matching'
import type { PropertyMatch } from '@/types/lead'

const TILE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const PT_CENTER: [number, number] = [-8.0, 39.5]
const PT_ZOOM = 6.4

interface ZonasMapPickerProps {
  open: boolean
  onClose: () => void
  onSave: (zones: NegocioZone[]) => void
  initialZones: NegocioZone[]
  negocioId: string
}

export function ZonasMapPicker({
  open,
  onClose,
  onSave,
  initialZones,
  negocioId,
}: ZonasMapPickerProps) {
  const isMobile = useIsMobile()
  const [zones, setZones] = useState<NegocioZone[]>(initialZones)
  const [properties, setProperties] = useState<PropertyMatch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Drawing state (refs to dodge stale closures inside maplibre handlers)
  const [isDrawing, setIsDrawing] = useState(false)
  const isDrawingRef = useRef(false)
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([])
  const drawPointsRef = useRef<[number, number][]>([])

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const popupRef = useRef<maplibregl.Popup | null>(null)

  // Reset state on open/close
  useEffect(() => {
    if (open) {
      setZones(initialZones)
      setHasChanges(false)
      setIsDrawing(false)
      setDrawPoints([])
      drawPointsRef.current = []
    }
    // when closed, MapLibre cleanup handled by separate effect
  }, [open, initialZones])

  // Track changes
  useEffect(() => {
    if (!open) return
    const same =
      zones.length === initialZones.length &&
      zones.every((z, i) => JSON.stringify(z) === JSON.stringify(initialZones[i]))
    setHasChanges(!same)
  }, [zones, initialZones, open])

  // Fetch matches whenever zones change
  useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    setIsLoading(true)
    fetch(`/api/negocios/${negocioId}/matches/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zonas: zones }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setProperties(d.data ?? []))
      .catch(() => setProperties([]))
      .finally(() => setIsLoading(false))
    return () => ctrl.abort()
  }, [zones, open, negocioId])

  // Initialize map when picker opens
  useEffect(() => {
    if (!open) return
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: TILE_URL,
      center: PT_CENTER,
      zoom: PT_ZOOM,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      popupRef.current?.remove()
      popupRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [open])

  // Toggle draw mode
  useEffect(() => {
    isDrawingRef.current = isDrawing
    const m = mapRef.current
    if (!m) return
    if (isDrawing) {
      m.getCanvas().style.cursor = 'crosshair'
      m.dragPan.disable()
      m.doubleClickZoom.disable()
    } else {
      m.getCanvas().style.cursor = ''
      m.dragPan.enable()
      m.doubleClickZoom.enable()
    }
  }, [isDrawing])

  // Click handler for adding draw vertices
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    const handler = (e: maplibregl.MapMouseEvent) => {
      if (!isDrawingRef.current) return
      const next: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      drawPointsRef.current = [...drawPointsRef.current, next]
      setDrawPoints([...drawPointsRef.current])
    }
    m.on('click', handler)
    return () => {
      m.off('click', handler)
    }
  }, [open])

  // Render in-progress draw polygon as the user clicks vertices
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    const apply = () => updateDrawPolygon(m, drawPoints)
    if (m.isStyleLoaded()) apply()
    else m.once('load', apply)
  }, [drawPoints])

  // Render property markers
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    const apply = () => {
      // Clear stale
      markersRef.current.forEach((mk) => mk.remove())
      markersRef.current = []

      const withCoords = properties.filter(
        (p) => p.latitude != null && p.longitude != null
      )

      withCoords.forEach((p) => {
        const el = document.createElement('div')
        const isRent = (p.business_type ?? '').toLowerCase().includes('arrend')
        const priceLabel = isRent
          ? `${formatCurrency(p.listing_price)}/mês`
          : formatCurrency(p.listing_price)
        el.innerHTML = `
          <div style="
            background: ${isRent ? '#6366f1' : '#000000'};
            color: white;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            cursor: pointer;
            border: 2px solid white;
          ">${priceLabel}</div>
        `
        el.addEventListener('click', (ev) => {
          if (isDrawingRef.current) return
          ev.stopPropagation()
          showPropertyPopup(m, p)
        })
        if (!window.matchMedia('(pointer: coarse)').matches) {
          el.addEventListener('mouseenter', () => showPropertyPopup(m, p))
          el.addEventListener('mouseleave', () => schedulePopupHide())
        }

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([p.longitude!, p.latitude!])
          .addTo(m)
        markersRef.current.push(marker)
      })

      // Fit bounds when there are properties and we're not actively drawing
      if (withCoords.length > 0 && !isDrawingRef.current && drawPointsRef.current.length === 0) {
        const bounds = new maplibregl.LngLatBounds()
        withCoords.forEach((p) => bounds.extend([p.longitude!, p.latitude!]))
        m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 })
      }
    }
    if (m.isStyleLoaded()) apply()
    else m.once('load', apply)
  }, [properties])

  const showPropertyPopup = useCallback(
    (map: maplibregl.Map, p: PropertyMatch) => {
      if (popupRef.current) popupRef.current.remove()
      const isRent = (p.business_type ?? '').toLowerCase().includes('arrend')
      const priceLabel = isRent
        ? `${formatCurrency(p.listing_price)}/mês`
        : formatCurrency(p.listing_price)
      const html = `
        <div style="font-family:system-ui,-apple-system,sans-serif;width:200px">
          ${p.cover_url ? `<img src="${p.cover_url}" style="width:100%;height:100px;object-fit:cover;border-radius:8px 8px 0 0" />` : ''}
          <div style="padding:8px 10px">
            <p style="margin:0 0 2px;font-size:13px;font-weight:600;line-height:1.3">${escapeHtml(p.title)}</p>
            ${p.city ? `<p style="margin:0 0 4px;font-size:11px;color:#6b7280">${escapeHtml(p.city)}${p.zone ? `, ${escapeHtml(p.zone)}` : ''}</p>` : ''}
            <p style="margin:0;font-size:13px;font-weight:700">${priceLabel}</p>
          </div>
        </div>
      `
      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 18,
        maxWidth: '220px',
      })
        .setLngLat([p.longitude!, p.latitude!])
        .setHTML(html)
        .addTo(map)
    },
    []
  )

  const schedulePopupHide = useCallback(() => {
    setTimeout(() => {
      popupRef.current?.remove()
      popupRef.current = null
    }, 250)
  }, [])

  // ─── Zone management ───

  const excludeAdminIds = useMemo(
    () => zones.filter((z): z is Extract<NegocioZone, { kind: 'admin' }> => z.kind === 'admin').map((z) => z.area_id),
    [zones]
  )

  const handleAddAdmin = useCallback((r: AdminAreaSearchResult) => {
    if (excludeAdminIds.includes(r.id)) return
    setZones((prev) => [...prev, { kind: 'admin', area_id: r.id, label: adminAreaLabel(r) }])
  }, [excludeAdminIds])

  const handleRemoveZone = useCallback((index: number) => {
    setZones((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // ─── Drawing actions ───

  const startDrawing = useCallback(() => {
    drawPointsRef.current = []
    setDrawPoints([])
    setIsDrawing(true)
  }, [])

  const cancelDrawing = useCallback(() => {
    drawPointsRef.current = []
    setDrawPoints([])
    setIsDrawing(false)
    if (mapRef.current) clearDrawPolygon(mapRef.current)
  }, [])

  const finishDrawing = useCallback(() => {
    if (drawPointsRef.current.length < 3) return
    const ring = [...drawPointsRef.current, drawPointsRef.current[0]]
    setZones((prev) => [
      ...prev,
      {
        kind: 'polygon',
        id: crypto.randomUUID(),
        label: `Zona desenhada ${prev.filter((z) => z.kind === 'polygon').length + 1}`,
        geometry: { type: 'Polygon', coordinates: [ring] },
      },
    ])
    drawPointsRef.current = []
    setDrawPoints([])
    setIsDrawing(false)
    if (mapRef.current) clearDrawPolygon(mapRef.current)
  }, [])

  const handleSave = useCallback(() => {
    onSave(zones)
    onClose()
  }, [zones, onSave, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col lg:flex-row">
      {/* Sidebar (desktop) / Header + List (mobile) */}
      <div
        className={cn(
          'flex flex-col bg-background',
          'lg:w-[360px] lg:border-r lg:border-border/50',
          isMobile ? 'order-2 flex-1 min-h-0' : ''
        )}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center hover:bg-muted/50 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="text-sm text-muted-foreground flex-1 truncate">
            {isLoading ? 'A pesquisar...' : `${properties.length} ${properties.length === 1 ? 'imóvel' : 'imóveis'}`}
          </p>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Guardar
          </Button>
        </div>

        {/* Active zones + autocomplete */}
        <div className="shrink-0 px-4 py-3 border-b border-border/40 space-y-2.5">
          {zones.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {zones.map((zone, i) => {
                const Icon =
                  zone.kind === 'polygon'
                    ? Pencil
                    : zone.label.includes('Distrito')
                      ? MapIcon
                      : zone.label.includes('Concelho')
                        ? Building2
                        : MapPin
                return (
                  <span
                    key={zone.kind === 'polygon' ? zone.id : `admin-${zone.area_id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 border border-border/40 px-2.5 py-1 text-xs"
                  >
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium max-w-[180px] truncate">{zone.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveZone(i)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/15 p-0.5"
                      aria-label={`Remover ${zone.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
          <AdminAreaAutocomplete
            onSelect={handleAddAdmin}
            excludeIds={excludeAdminIds}
            placeholder="Adicionar concelho ou freguesia..."
          />
        </div>

        {/* Property cards (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />A carregar imóveis...
            </div>
          ) : properties.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Home className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              {zones.length === 0
                ? 'Adiciona zonas para filtrar os imóveis pelo local pretendido.'
                : 'Nenhum imóvel cumpre os critérios + estas zonas.'}
            </div>
          ) : (
            <div
              className={cn(
                isMobile ? 'grid grid-cols-2 gap-2 p-3' : 'p-2 space-y-2'
              )}
            >
              {properties.map((p) => (
                <PropertyMiniCard key={p.id} property={p} compact={isMobile} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div
        className={cn(
          'relative bg-muted',
          isMobile ? 'order-1 h-[40dvh] shrink-0' : 'flex-1'
        )}
      >
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Draw button overlay */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          {!isDrawing ? (
            <Button
              size="sm"
              onClick={startDrawing}
              className="rounded-full shadow-lg bg-background text-foreground hover:bg-background/90 border border-border/60"
              variant="outline"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Desenhar área
            </Button>
          ) : (
            <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm rounded-full pl-3 pr-1 py-1 shadow-lg border border-border/60">
              <span className="text-xs text-muted-foreground">
                {drawPoints.length < 3
                  ? `${drawPoints.length} pontos · mín. 3`
                  : `${drawPoints.length} pontos`}
              </span>
              <button
                type="button"
                onClick={finishDrawing}
                disabled={drawPoints.length < 3}
                className={cn(
                  'h-7 px-3 rounded-full text-xs font-medium flex items-center transition-colors',
                  drawPoints.length >= 3
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                <Check className="mr-1 h-3 w-3" />
                Concluir
              </button>
              <button
                type="button"
                onClick={cancelDrawing}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted/60 text-muted-foreground"
                aria-label="Cancelar desenho"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Property mini card ───
function PropertyMiniCard({
  property,
  compact,
}: {
  property: PropertyMatch
  compact?: boolean
}) {
  const isRent = (property.business_type ?? '').toLowerCase().includes('arrend')
  const isReserved = property.status === 'reserved'
  const priceLabel = property.listing_price
    ? isRent
      ? `${formatCurrency(property.listing_price)}/mês`
      : formatCurrency(property.listing_price)
    : 'Sob Consulta'
  const typology = property.specs?.typology || (property.specs?.bedrooms ? `T${property.specs.bedrooms}` : null)
  const area = property.specs?.area_util ?? property.specs?.area_gross ?? null

  return (
    <a
      href={`/dashboard/imoveis/${property.slug || property.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group block rounded-xl border border-border/50 overflow-hidden hover:shadow-md hover:border-primary/30 transition-all',
        compact ? '' : 'flex gap-3 p-2 bg-card'
      )}
    >
      {compact ? (
        <>
          <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            {property.cover_url ? (
              <img src={property.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Home className="h-6 w-6 text-muted-foreground/30" />
              </div>
            )}
            {isReserved && (
              <span className="absolute top-1.5 left-1.5 rounded-md bg-amber-500/90 text-white text-[9px] font-semibold px-1.5 py-0.5">
                Reservado
              </span>
            )}
          </div>
          <div className="px-2 py-2">
            <p className="text-[11px] font-medium line-clamp-1">{property.title}</p>
            <p className="text-[10px] text-muted-foreground line-clamp-1">
              {property.city}
              {property.zone ? `, ${property.zone}` : ''}
            </p>
            <p className="text-xs font-semibold mt-1">{priceLabel}</p>
          </div>
        </>
      ) : (
        <>
          <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
            {property.cover_url ? (
              <img src={property.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Home className="h-5 w-5 text-muted-foreground/30" />
              </div>
            )}
            {isReserved && (
              <span className="absolute bottom-0 left-0 right-0 bg-amber-500/90 text-white text-[8px] font-semibold text-center py-0.5">
                Reservado
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-1">{property.title}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">
                {property.city}
                {property.zone ? `, ${property.zone}` : ''}
              </span>
            </p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
              {typology && <span>{typology}</span>}
              {area != null && (
                <span className="flex items-center gap-0.5">
                  <Maximize className="h-2.5 w-2.5" /> {Math.round(area)} m²
                </span>
              )}
              {property.specs?.bedrooms != null && (
                <span className="flex items-center gap-0.5">
                  <Bed className="h-2.5 w-2.5" /> {property.specs.bedrooms}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold mt-1">{priceLabel}</p>
          </div>
        </>
      )}
    </a>
  )
}

// ─── MapLibre helpers (draw geometry) ───

function updateDrawPolygon(map: maplibregl.Map, points: [number, number][]) {
  if (!map.isStyleLoaded()) return

  const pointsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: points.map((p) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Point' as const, coordinates: p },
    })),
  }
  upsertSource(map, 'draw-points', pointsGeoJSON)
  upsertLayer(map, {
    id: 'draw-points-layer',
    type: 'circle',
    source: 'draw-points',
    paint: {
      'circle-radius': 5,
      'circle-color': '#000',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  })

  if (points.length >= 2) {
    upsertSource(map, 'draw-line', {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: points },
    })
    upsertLayer(map, {
      id: 'draw-line-layer',
      type: 'line',
      source: 'draw-line',
      paint: {
        'line-color': '#000',
        'line-width': 2,
        'line-dasharray': [2, 2],
      },
    })
  } else {
    removeIf(map, ['draw-line-layer'], ['draw-line'])
  }

  if (points.length >= 3) {
    upsertSource(map, 'draw-polygon', {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[...points, points[0]]],
      },
    })
    upsertLayer(map, {
      id: 'draw-polygon-fill',
      type: 'fill',
      source: 'draw-polygon',
      paint: { 'fill-color': '#000', 'fill-opacity': 0.15 },
    })
    upsertLayer(map, {
      id: 'draw-polygon-border',
      type: 'line',
      source: 'draw-polygon',
      paint: { 'line-color': '#000', 'line-width': 1.5 },
    })
  } else {
    removeIf(map, ['draw-polygon-fill', 'draw-polygon-border'], ['draw-polygon'])
  }
}

function clearDrawPolygon(map: maplibregl.Map) {
  if (!map.isStyleLoaded()) return
  removeIf(
    map,
    ['draw-points-layer', 'draw-line-layer', 'draw-polygon-fill', 'draw-polygon-border'],
    ['draw-points', 'draw-line', 'draw-polygon']
  )
}

function upsertSource(
  map: maplibregl.Map,
  id: string,
  data: GeoJSON.Feature | GeoJSON.FeatureCollection
) {
  const existing = map.getSource(id) as maplibregl.GeoJSONSource | undefined
  if (existing) existing.setData(data)
  else map.addSource(id, { type: 'geojson', data })
}

function upsertLayer(map: maplibregl.Map, spec: maplibregl.LayerSpecification) {
  if (!map.getLayer(spec.id)) map.addLayer(spec)
}

function removeIf(map: maplibregl.Map, layers: string[], sources: string[]) {
  for (const id of layers) if (map.getLayer(id)) map.removeLayer(id)
  for (const id of sources) if (map.getSource(id)) map.removeSource(id)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&'
      ? '&amp;'
      : c === '<'
        ? '&lt;'
        : c === '>'
          ? '&gt;'
          : c === '"'
            ? '&quot;'
            : '&#39;'
  )
}
