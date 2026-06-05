'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Check, X, Trash2 } from 'lucide-react'

const TILE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const PT_CENTER: [number, number] = [-8.0, 39.5]
const PT_ZOOM = 6.4

interface DrawPolygonMapProps {
  /** Chamado quando o utilizador finaliza um polígono (Concluir). */
  onComplete: (polygon: { label: string; coordinates: number[][][] }) => void
  /** Chamado quando o utilizador cancela. */
  onCancel?: () => void
}

export function DrawPolygonMap({ onComplete, onCancel }: DrawPolygonMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const [points, setPoints] = useState<[number, number][]>([])
  const pointsRef = useRef<[number, number][]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const isDrawingRef = useRef(false)
  const [label, setLabel] = useState('')

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: TILE_URL,
      center: PT_CENTER,
      zoom: PT_ZOOM,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Toggle drawing mode (cursor + dragPan + scrollZoom)
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

  // Click handler para adicionar vertice
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    const handler = (e: maplibregl.MapMouseEvent) => {
      if (!isDrawingRef.current) return
      const next: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      pointsRef.current = [...pointsRef.current, next]
      setPoints([...pointsRef.current])
    }
    m.on('click', handler)
    return () => {
      m.off('click', handler)
    }
  }, [])

  // Re-render geometry sources/layers when points change
  useEffect(() => {
    const m = mapRef.current
    if (!m || !m.isStyleLoaded()) {
      // Wait for style ready
      const onLoad = () => updatePolygon(mapRef.current!, points)
      mapRef.current?.once('load', onLoad)
      return
    }
    updatePolygon(m, points)
  }, [points])

  const handleStart = useCallback(() => {
    pointsRef.current = []
    setPoints([])
    setIsDrawing(true)
  }, [])

  const handleClear = useCallback(() => {
    pointsRef.current = []
    setPoints([])
    setIsDrawing(false)
    if (mapRef.current) clearPolygon(mapRef.current)
  }, [])

  const handleComplete = useCallback(() => {
    if (points.length < 3) return
    // Fechar o polígono (primeiro = último)
    const ring = [...points, points[0]]
    onComplete({
      label: label.trim() || 'Zona desenhada',
      coordinates: [ring],
    })
    setIsDrawing(false)
  }, [points, label, onComplete])

  const canComplete = points.length >= 3

  return (
    <div className="space-y-3">
      <div className="relative">
        <div ref={mapContainer} className="h-[400px] w-full rounded-lg overflow-hidden bg-muted" />
        {!isDrawing && points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-background/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-3 pointer-events-auto">
              <p className="text-sm font-medium mb-2">Como desenhar</p>
              <ol className="text-xs text-muted-foreground space-y-0.5 mb-3">
                <li>1. Clica em &quot;Iniciar desenho&quot;</li>
                <li>2. Clica no mapa para adicionar pontos</li>
                <li>3. Mínimo 3 pontos para fechar</li>
                <li>4. Clica &quot;Concluir&quot; quando terminares</li>
              </ol>
              <Button size="sm" onClick={handleStart} className="w-full">
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Iniciar desenho
              </Button>
            </div>
          </div>
        )}
      </div>

      {(isDrawing || points.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{points.length} ponto{points.length === 1 ? '' : 's'} colocado{points.length === 1 ? '' : 's'}</span>
            <span>{canComplete ? '✓ Pronto a concluir' : 'Mínimo 3 pontos'}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zone-label" className="text-xs">
              Nome da zona (opcional)
            </Label>
            <Input
              id="zone-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Zona Almada centro"
              className="h-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleComplete}
              disabled={!canComplete}
              className="flex-1"
            >
              <Check className="mr-2 h-3.5 w-3.5" />
              Concluir
            </Button>
            <Button size="sm" variant="outline" onClick={handleClear}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Limpar
            </Button>
            {onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                <X className="mr-2 h-3.5 w-3.5" />
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers para desenhar a geometria ───

function updatePolygon(map: maplibregl.Map, points: [number, number][]) {
  if (!map.isStyleLoaded()) return

  // Pontos
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

  // Linha (entre pontos consecutivos)
  if (points.length >= 2) {
    const lineGeoJSON = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: points,
      },
    }
    upsertSource(map, 'draw-line', lineGeoJSON)
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
    removeLayerAndSource(map, 'draw-line')
  }

  // Polígono (preenchido) quando ≥3 pontos
  if (points.length >= 3) {
    const polyGeoJSON = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[...points, points[0]]],
      },
    }
    upsertSource(map, 'draw-polygon', polyGeoJSON)
    upsertLayer(map, {
      id: 'draw-polygon-fill',
      type: 'fill',
      source: 'draw-polygon',
      paint: {
        'fill-color': '#000',
        'fill-opacity': 0.15,
      },
    })
    upsertLayer(map, {
      id: 'draw-polygon-border',
      type: 'line',
      source: 'draw-polygon',
      paint: {
        'line-color': '#000',
        'line-width': 1.5,
      },
    })
  } else {
    removeLayerAndSource(map, 'draw-polygon')
  }
}

function clearPolygon(map: maplibregl.Map) {
  if (!map.isStyleLoaded()) return
  for (const layerId of ['draw-points-layer', 'draw-line-layer', 'draw-polygon-fill', 'draw-polygon-border']) {
    if (map.getLayer(layerId)) map.removeLayer(layerId)
  }
  for (const sourceId of ['draw-points', 'draw-line', 'draw-polygon']) {
    if (map.getSource(sourceId)) map.removeSource(sourceId)
  }
}

function upsertSource(
  map: maplibregl.Map,
  id: string,
  data: GeoJSON.Feature | GeoJSON.FeatureCollection
) {
  const existing = map.getSource(id) as maplibregl.GeoJSONSource | undefined
  if (existing) {
    existing.setData(data)
  } else {
    map.addSource(id, { type: 'geojson', data })
  }
}

function upsertLayer(map: maplibregl.Map, spec: maplibregl.LayerSpecification) {
  if (!map.getLayer(spec.id)) {
    map.addLayer(spec)
  }
}

function removeLayerAndSource(map: maplibregl.Map, id: string) {
  for (const suffix of ['-layer', '-fill', '-border', '']) {
    const layerId = id + suffix
    if (map.getLayer(layerId)) map.removeLayer(layerId)
  }
  if (map.getSource(id)) map.removeSource(id)
}
