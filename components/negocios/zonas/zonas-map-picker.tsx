'use client'

/**
 * Full-screen experience to add zones to a negocio while seeing the
 * properties that match the rest of the criteria.
 *
 * Layout
 *   • Desktop: 360px sidebar (chips + autocomplete + cards) | map.
 *   • Mobile : map on top (~40dvh), 2-col card grid below.
 *
 * Map interactions
 *   • Custom HTML markers as price pills (black=sale, indigo=rent),
 *     scale 1.1 + stronger shadow on hover.
 *   • Hover a card → flyTo at zoom 15 + popup; mouseleave → restore the
 *     pre-hover view, debounced 100ms so sweeping cards doesn't ping-pong.
 *   • Hover a marker → popup with image + title + price; popup persists
 *     300ms after mouseleave so users can move into it. Popup itself is
 *     clickable and opens the property page.
 *   • Click suppressed while drawing.
 *   • Bottom-left: "Encaixar tudo" (fitBounds). Bottom-right: live count.
 *
 * Drawing
 *   • "Desenhar área" button in top-left enters draw mode (dragPan +
 *     scrollZoom disabled; cursor → crosshair). Each click adds a vertex.
 *   • Pencil refs (`isDrawingRef`, `drawPointsRef`) mirror the React
 *     state so MapLibre handlers don't close over stale values.
 *
 * Live updates
 *   • Each `zones` change posts to /api/negocios/[id]/matches/preview.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  ArrowLeft,
  Pencil,
  Plus,
  X,
  MapPin,
  Building2,
  Map as MapIcon,
  Home,
  Bed,
  Maximize,
  Loader2,
  Check,
  Trash2,
  LocateFixed,
} from 'lucide-react'
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
  const isTouchRef = useRef(false)
  useEffect(() => {
    isTouchRef.current = window.matchMedia('(pointer: coarse)').matches
  }, [])

  const [zones, setZones] = useState<NegocioZone[]>(initialZones)
  const [properties, setProperties] = useState<PropertyMatch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Drawing state (refs to dodge stale closures inside maplibre handlers)
  const [isDrawing, setIsDrawing] = useState(false)
  const isDrawingRef = useRef(false)
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([])
  const drawPointsRef = useRef<[number, number][]>([])
  const [drawLabel, setDrawLabel] = useState('')

  // Inline rename of an already-saved zone (chip click)
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLDivElement }>>(
    new Map()
  )
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const popupHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onPropertyClickRef = useRef<(p: PropertyMatch) => void>(() => {})

  // Pre-hover view state — saved once per hover-session for restore.
  const preHoverViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null)
  const restoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Reset state on open
  useEffect(() => {
    if (open) {
      setZones(initialZones)
      setHasChanges(false)
      setIsDrawing(false)
      setDrawPoints([])
      drawPointsRef.current = []
      setDrawLabel('')
      setRenamingIndex(null)
      setRenameDraft('')
      preHoverViewRef.current = null
    }
  }, [open, initialZones])

  // Track "dirty" state vs initial
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
      markersRef.current.forEach((m) => m.marker.remove())
      markersRef.current.clear()
      popupRef.current?.remove()
      popupRef.current = null
      if (restoreTimeoutRef.current) clearTimeout(restoreTimeoutRef.current)
      if (popupHideTimeoutRef.current) clearTimeout(popupHideTimeoutRef.current)
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
      m.scrollZoom.disable()
    } else {
      m.getCanvas().style.cursor = ''
      m.dragPan.enable()
      m.doubleClickZoom.enable()
      m.scrollZoom.enable()
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

  // Render in-progress polygon as the user clicks vertices
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    const apply = () => updateDrawPolygon(m, drawPoints)
    if (m.isStyleLoaded()) apply()
    else m.once('load', apply)
  }, [drawPoints])

  // ─── Hover popup ───
  const showPropertyPopup = useCallback((map: maplibregl.Map, p: PropertyMatch) => {
    if (popupHideTimeoutRef.current) {
      clearTimeout(popupHideTimeoutRef.current)
      popupHideTimeoutRef.current = null
    }
    if (popupRef.current) popupRef.current.remove()

    const isRent = (p.business_type ?? '').toLowerCase().includes('arrend')
    const isReserved = p.status === 'reserved'
    const priceLabel = isReserved
      ? 'Sob Consulta'
      : p.listing_price
        ? isRent
          ? `${formatCurrency(p.listing_price)}/mês`
          : formatCurrency(p.listing_price)
        : 'Sob Consulta'
    const html = `
      <div data-property-popup data-property-id="${p.id}"
           style="font-family:system-ui,-apple-system,sans-serif;width:220px;cursor:pointer;background:white;border-radius:10px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.18)">
        ${p.cover_url ? `<img src="${p.cover_url}" style="width:100%;height:120px;object-fit:cover;display:block" />` : ''}
        <div style="padding:9px 11px">
          <p style="margin:0 0 2px;font-size:13px;font-weight:600;line-height:1.3;color:#0a0a0a">${escapeHtml(p.title)}</p>
          ${p.city ? `<p style="margin:0 0 4px;font-size:11px;color:#6b7280">${escapeHtml(p.city)}${p.zone ? `, ${escapeHtml(p.zone)}` : ''}</p>` : ''}
          ${
            isReserved
              ? `<span style="display:inline-block;background:#f59e0b;color:white;font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;margin-bottom:4px">Reservado</span>`
              : ''
          }
          <p style="margin:0;font-size:13px;font-weight:700;color:#0a0a0a">${priceLabel}</p>
        </div>
      </div>
    `
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: [0, -10],
      maxWidth: '240px',
      className: 'zonas-picker-popup',
    })
      .setLngLat([p.longitude!, p.latitude!])
      .setHTML(html)
      .addTo(map)

    // Make popup itself hover-stable + clickable
    const el = popup.getElement()
    el.addEventListener('mouseenter', () => {
      if (popupHideTimeoutRef.current) {
        clearTimeout(popupHideTimeoutRef.current)
        popupHideTimeoutRef.current = null
      }
    })
    el.addEventListener('mouseleave', () => schedulePopupHide())
    el.addEventListener('click', (ev) => {
      ev.stopPropagation()
      onPropertyClickRef.current(p)
    })

    popupRef.current = popup
  }, [])

  const schedulePopupHide = useCallback(() => {
    if (popupHideTimeoutRef.current) clearTimeout(popupHideTimeoutRef.current)
    popupHideTimeoutRef.current = setTimeout(() => {
      popupRef.current?.remove()
      popupRef.current = null
      popupHideTimeoutRef.current = null
    }, 300)
  }, [])

  // Open property in new tab — wired into refs that markers / popups read.
  useEffect(() => {
    onPropertyClickRef.current = (p) => {
      const url = `/dashboard/imoveis/${p.slug || p.id}`
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }, [])

  // Render markers when properties change
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    const apply = () => {
      // Clear stale
      markersRef.current.forEach(({ marker }) => marker.remove())
      markersRef.current.clear()

      const withCoords = properties.filter(
        (p) => p.latitude != null && p.longitude != null
      )

      withCoords.forEach((p) => {
        const el = document.createElement('div')
        el.className = 'zonas-picker-marker'
        const isRent = (p.business_type ?? '').toLowerCase().includes('arrend')
        const isReserved = p.status === 'reserved'
        const priceLabel = isReserved
          ? 'Reservado'
          : isRent
            ? `${formatCurrency(p.listing_price)}/mês`
            : formatCurrency(p.listing_price)
        const bg = isRent ? '#6366f1' : '#000000'
        const bgHover = isRent ? '#4f46e5' : '#1f1f1f'
        el.innerHTML = `
          <div data-pill style="
            background: ${bg};
            color: white;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            cursor: pointer;
            border: 2px solid white;
            transition: transform 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
          ">${priceLabel}</div>
        `
        const pill = el.querySelector('[data-pill]') as HTMLDivElement | null
        const enterStyle = () => {
          if (!pill) return
          pill.style.transform = 'scale(1.1)'
          pill.style.boxShadow = '0 6px 14px rgba(0,0,0,0.35)'
          pill.style.background = bgHover
        }
        const leaveStyle = () => {
          if (!pill) return
          pill.style.transform = ''
          pill.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)'
          pill.style.background = bg
        }

        el.addEventListener('click', (ev) => {
          if (isDrawingRef.current) return
          ev.stopPropagation()
          onPropertyClickRef.current(p)
        })

        if (!isTouchRef.current) {
          el.addEventListener('mouseenter', () => {
            if (isDrawingRef.current) return
            enterStyle()
            showPropertyPopup(m, p)
          })
          el.addEventListener('mouseleave', () => {
            leaveStyle()
            schedulePopupHide()
          })
        }

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([p.longitude!, p.latitude!])
          .addTo(m)
        markersRef.current.set(p.id, { marker, el })
      })

      // Fit bounds when properties present and no active draw / saved view
      if (
        withCoords.length > 0 &&
        !isDrawingRef.current &&
        drawPointsRef.current.length === 0 &&
        !preHoverViewRef.current
      ) {
        const bounds = new maplibregl.LngLatBounds()
        withCoords.forEach((p) => bounds.extend([p.longitude!, p.latitude!]))
        m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 })
      }
    }
    if (m.isStyleLoaded()) apply()
    else m.once('load', apply)
  }, [properties, showPropertyPopup, schedulePopupHide])

  // Highlight hovered card's marker visually
  useEffect(() => {
    markersRef.current.forEach(({ el }, id) => {
      const pill = el.querySelector('[data-pill]') as HTMLDivElement | null
      if (!pill) return
      if (id === hoveredId) {
        pill.style.transform = 'scale(1.1)'
        pill.style.zIndex = '10'
      } else {
        pill.style.transform = ''
        pill.style.zIndex = ''
      }
    })
  }, [hoveredId])

  // ─── Card hover sync ───
  const handleCardEnter = useCallback(
    (p: PropertyMatch) => {
      if (isTouchRef.current) return
      if (p.latitude == null || p.longitude == null) return
      const m = mapRef.current
      if (!m) return
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current)
        restoreTimeoutRef.current = null
      }
      // Save view exactly once per hover-session
      if (!preHoverViewRef.current) {
        const c = m.getCenter()
        preHoverViewRef.current = { center: [c.lng, c.lat], zoom: m.getZoom() }
      }
      m.flyTo({ center: [p.longitude, p.latitude], zoom: 15, duration: 800 })
      showPropertyPopup(m, p)
      setHoveredId(p.id)
    },
    [showPropertyPopup]
  )

  const handleCardLeave = useCallback(() => {
    if (isTouchRef.current) return
    setHoveredId(null)
    if (popupHideTimeoutRef.current) clearTimeout(popupHideTimeoutRef.current)
    popupRef.current?.remove()
    popupRef.current = null
    popupHideTimeoutRef.current = null
    if (restoreTimeoutRef.current) clearTimeout(restoreTimeoutRef.current)
    restoreTimeoutRef.current = setTimeout(() => {
      const m = mapRef.current
      if (preHoverViewRef.current && m) {
        m.flyTo({
          center: preHoverViewRef.current.center,
          zoom: preHoverViewRef.current.zoom,
          duration: 800,
        })
        preHoverViewRef.current = null
      }
    }, 100)
  }, [])

  // ─── Zone management ───

  const excludeAdminIds = useMemo(
    () =>
      zones
        .filter((z): z is Extract<NegocioZone, { kind: 'admin' }> => z.kind === 'admin')
        .map((z) => z.area_id),
    [zones]
  )

  const handleAddAdmin = useCallback(
    (r: AdminAreaSearchResult) => {
      if (excludeAdminIds.includes(r.id)) return
      setZones((prev) => [
        ...prev,
        { kind: 'admin', area_id: r.id, label: adminAreaLabel(r) },
      ])
    },
    [excludeAdminIds]
  )

  const handleRemoveZone = useCallback((index: number) => {
    setZones((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // ─── Drawing actions ───

  const startDrawing = useCallback(() => {
    drawPointsRef.current = []
    setDrawPoints([])
    setDrawLabel('')
    setIsDrawing(true)
  }, [])

  const cancelDrawing = useCallback(() => {
    drawPointsRef.current = []
    setDrawPoints([])
    setDrawLabel('')
    setIsDrawing(false)
    if (mapRef.current) clearDrawPolygon(mapRef.current)
  }, [])

  const finishDrawing = useCallback(() => {
    if (drawPointsRef.current.length < 3) return
    const ring = [...drawPointsRef.current, drawPointsRef.current[0]]
    setZones((prev) => {
      const fallback = `Zona desenhada ${prev.filter((z) => z.kind === 'polygon').length + 1}`
      const label = drawLabel.trim() || fallback
      return [
        ...prev,
        {
          kind: 'polygon',
          id: crypto.randomUUID(),
          label,
          geometry: { type: 'Polygon', coordinates: [ring] },
        },
      ]
    })
    drawPointsRef.current = []
    setDrawPoints([])
    setDrawLabel('')
    setIsDrawing(false)
    if (mapRef.current) clearDrawPolygon(mapRef.current)
  }, [drawLabel])

  // ─── Rename zone (chip click) ───
  const startRename = useCallback((index: number, currentLabel: string) => {
    setRenamingIndex(index)
    setRenameDraft(currentLabel)
  }, [])

  const commitRename = useCallback(() => {
    if (renamingIndex === null) return
    const idx = renamingIndex
    const newLabel = renameDraft.trim()
    setZones((prev) => {
      if (!newLabel) return prev
      const next = [...prev]
      const z = next[idx]
      if (z) next[idx] = { ...z, label: newLabel } as NegocioZone
      return next
    })
    setRenamingIndex(null)
    setRenameDraft('')
  }, [renamingIndex, renameDraft])

  const cancelRename = useCallback(() => {
    setRenamingIndex(null)
    setRenameDraft('')
  }, [])

  const handleSave = useCallback(() => {
    onSave(zones)
    onClose()
  }, [zones, onSave, onClose])

  // ─── Fit-to-all ───
  const handleFitAll = useCallback(() => {
    const m = mapRef.current
    if (!m) return
    const withCoords = properties.filter(
      (p) => p.latitude != null && p.longitude != null
    )
    if (withCoords.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    withCoords.forEach((p) => bounds.extend([p.longitude!, p.latitude!]))
    m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 })
    preHoverViewRef.current = null
  }, [properties])

  if (!open) return null

  const propertiesWithCoords = properties.filter(
    (p) => p.latitude != null && p.longitude != null
  )

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
            {isLoading
              ? 'A pesquisar...'
              : `${properties.length} ${properties.length === 1 ? 'imóvel' : 'imóveis'}`}
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
                const isRenaming = renamingIndex === i
                const canRename = zone.kind === 'polygon'

                if (isRenaming) {
                  return (
                    <span
                      key={zone.kind === 'polygon' ? zone.id : `admin-${zone.area_id}`}
                      className="inline-flex items-center gap-1 rounded-full bg-background border border-primary/40 px-2 py-0.5 text-xs ring-2 ring-primary/20"
                    >
                      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitRename()
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            cancelRename()
                          }
                        }}
                        onBlur={commitRename}
                        className="bg-transparent text-xs font-medium outline-none w-[140px]"
                        autoFocus
                      />
                    </span>
                  )
                }

                return (
                  <span
                    key={zone.kind === 'polygon' ? zone.id : `admin-${zone.area_id}`}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full bg-muted/70 border border-border/40 px-2.5 py-1 text-xs',
                      canRename && 'hover:bg-muted hover:border-border/70 transition-colors'
                    )}
                  >
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    {canRename ? (
                      <button
                        type="button"
                        onClick={() => startRename(i, zone.label)}
                        className="font-medium max-w-[180px] truncate hover:underline cursor-text text-left"
                        title="Clica para renomear"
                      >
                        {zone.label}
                      </button>
                    ) : (
                      <span className="font-medium max-w-[180px] truncate">{zone.label}</span>
                    )}
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
            <div className={cn(isMobile ? 'grid grid-cols-2 gap-2 p-3' : 'p-2 space-y-2')}>
              {properties.map((p) => (
                <PropertyMiniCard
                  key={p.id}
                  property={p}
                  compact={isMobile}
                  onEnter={() => handleCardEnter(p)}
                  onLeave={handleCardLeave}
                  onClick={() => onPropertyClickRef.current(p)}
                />
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

        {/* Draw button / draw bar (top-left) */}
        <div className="absolute top-3 left-3 z-10 max-w-[calc(100%-1.5rem)]">
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
          ) : drawPoints.length < 3 ? (
            // Compact bar while still placing minimum vertices
            <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm rounded-full pl-3 pr-1 py-1 shadow-lg border border-border/60">
              <span className="text-xs text-muted-foreground">
                {drawPoints.length} pontos · mín. 3
              </span>
              <button
                type="button"
                onClick={cancelDrawing}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted/60 text-muted-foreground"
                aria-label="Cancelar desenho"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ) : (
            // Expanded bar once polygon is closeable: includes the name input
            <div className="bg-background/95 backdrop-blur-sm rounded-2xl shadow-lg border border-border/60 p-2.5 w-[300px] sm:w-[340px] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {drawPoints.length} pontos
                </span>
                <button
                  type="button"
                  onClick={cancelDrawing}
                  className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted/60 text-muted-foreground"
                  aria-label="Cancelar desenho"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <input
                type="text"
                value={drawLabel}
                onChange={(e) => setDrawLabel(e.target.value)}
                placeholder="Nome da zona (ex.: Almada centro)"
                className="w-full h-8 rounded-md border border-border/60 bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    finishDrawing()
                  }
                }}
              />
              <button
                type="button"
                onClick={finishDrawing}
                className="w-full h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center"
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                Concluir
              </button>
            </div>
          )}
        </div>

        {/* Fit-to-all (bottom-left, desktop only) */}
        {!isMobile && propertiesWithCoords.length > 0 && (
          <button
            type="button"
            onClick={handleFitAll}
            className="absolute bottom-4 left-4 z-10 h-9 w-9 rounded-full bg-background shadow-lg border border-border/60 flex items-center justify-center hover:bg-muted/50 transition-colors"
            aria-label="Encaixar todos os imóveis"
          >
            <LocateFixed className="h-4 w-4 text-foreground" />
          </button>
        )}

        {/* Live count pill (bottom-right, desktop only) */}
        {!isMobile && (
          <div className="absolute bottom-4 right-4 z-10 rounded-full bg-background/95 backdrop-blur-sm px-3 py-1.5 shadow-lg border border-border/60">
            <p className="text-xs font-medium">
              {propertiesWithCoords.length} {propertiesWithCoords.length === 1 ? 'imóvel' : 'imóveis'} no mapa
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Property mini card ───
function PropertyMiniCard({
  property,
  compact,
  onEnter,
  onLeave,
  onClick,
}: {
  property: PropertyMatch
  compact?: boolean
  onEnter: () => void
  onLeave: () => void
  onClick: () => void
}) {
  const isRent = (property.business_type ?? '').toLowerCase().includes('arrend')
  const isReserved = property.status === 'reserved'
  const priceLabel = isReserved
    ? 'Sob Consulta'
    : property.listing_price
      ? isRent
        ? `${formatCurrency(property.listing_price)}/mês`
        : formatCurrency(property.listing_price)
      : 'Sob Consulta'
  const typology =
    property.specs?.typology ||
    (property.specs?.bedrooms ? `T${property.specs.bedrooms}` : null)
  const area = property.specs?.area_util ?? property.specs?.area_gross ?? null

  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={cn(
        'group block w-full text-left rounded-xl border border-border/50 overflow-hidden hover:shadow-md hover:border-primary/30 transition-all',
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
    </button>
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
      paint: { 'fill-color': '#000', 'fill-opacity': 0.1 },
    })
    upsertLayer(map, {
      id: 'draw-polygon-border',
      type: 'line',
      source: 'draw-polygon',
      paint: {
        'line-color': '#000',
        'line-width': 1.5,
        'line-dasharray': [3, 2],
      },
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
