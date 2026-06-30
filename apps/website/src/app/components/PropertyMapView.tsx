"use client";

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Bed, Bath, Square, Pencil, Trash2, X, Layers, LocateFixed } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapProperty {
  id: number | string;
  title: string;
  location: string;
  price: string;
  priceValue: number;
  image: string;
  beds: number;
  baths: number;
  area_bruta: number;
  type: string;
  typology?: string;
  propertyType?: string;
  externalRef?: string;
  state?: string;
  slug?: string;
  latitude: number;
  longitude: number;
}

interface PropertyMapViewProps {
  properties: MapProperty[];
  onPropertyClick?: (property: MapProperty) => void;
  onDrawFilter?: (bounds: [number, number][]) => void;
}

export interface PropertyMapViewHandle {
  flyToProperty: (propertyId: string | number) => void;
  clearHighlight: () => void;
}

// Point-in-polygon check (ray casting)
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export const PropertyMapView = forwardRef<PropertyMapViewHandle, PropertyMapViewProps>(function PropertyMapView({ properties, onPropertyClick, onDrawFilter }, ref) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const router = useRouter();

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [activePolygon, setActivePolygon] = useState<[number, number][] | null>(null);
  const [hoveredProperty, setHoveredProperty] = useState<MapProperty | null>(null);
  const drawPointsRef = useRef<[number, number][]>([]);
  const isDrawingRef = useRef(false);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preHoverView = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const restoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Free tile source (OpenStreetMap via demotiles or other free providers)
  const TILE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: TILE_URL,
      center: [-9.14, 38.74], // Lisboa
      zoom: 11,
      attributionControl: true,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add/update markers when properties change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const validProperties = properties.filter(p => p.latitude && p.longitude);

    if (validProperties.length === 0) return;

    validProperties.forEach(property => {
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'property-marker';
      el.innerHTML = `
        <div style="
          background: ${property.type === 'rent' ? '#6366f1' : '#000000'};
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          border: 2px solid white;
        ">${property.price}</div>
      `;

      // Hover effect
      const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

      if (!isTouchDevice) {
        el.addEventListener('mouseenter', () => {
          el.firstElementChild?.setAttribute('style', `
            background: ${property.type === 'rent' ? '#4f46e5' : '#1a1a1a'};
            color: white;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            transform: scale(1.1);
            border: 2px solid white;
          `);
          showPopup(property);
        });

        el.addEventListener('mouseleave', () => {
          el.firstElementChild?.setAttribute('style', `
            background: ${property.type === 'rent' ? '#6366f1' : '#000000'};
            color: white;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            border: 2px solid white;
          `);
          // Delay hiding popup so user can interact with it
          if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
          popupTimeoutRef.current = setTimeout(() => {
            if (popupRef.current) {
              popupRef.current.remove();
              popupRef.current = null;
            }
          }, 300);
        });
      }

      // Click to navigate
      el.addEventListener('click', (e) => {
        if (isDrawingRef.current) return;
        e.stopPropagation();
        if (onPropertyClick) {
          onPropertyClick(property);
        } else if (property.slug) {
          router.push(`/property/${property.slug}`);
        }
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([property.longitude, property.latitude])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [properties, router, onPropertyClick]);

  // Show popup card on hover
  const showPopup = useCallback((property: MapProperty) => {
    if (!map.current) return;

    // Cancel any pending hide timeout
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = null;
    }

    // Remove existing popup
    if (popupRef.current) {
      popupRef.current.remove();
    }

    const isReserved = ['reserved', 'rented'].includes(property.state?.toLowerCase() || '');
    const displayPrice = isReserved ? 'Sob Consulta' : property.price;

    const popupHTML = `
      <div style="
        width: 280px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        cursor: pointer;
      " class="map-popup-card" data-slug="${property.slug || ''}">
        <div style="position: relative; width: 100%; height: 160px; overflow: hidden; border-radius: 12px 12px 0 0;">
          <img
            src="${property.image}"
            alt="${property.title}"
            style="width: 100%; height: 100%; object-fit: cover;"
          />
          <div style="
            position: absolute; top: 8px; left: 8px;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(8px);
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 500;
            border: 1px solid rgba(255,255,255,0.2);
          ">${property.type === 'sale' ? 'Venda' : 'Arrendamento'}</div>
          ${isReserved ? `
            <div style="
              position: absolute; top: 0; left: 0; right: 0;
              background: rgba(0,0,0,0.5);
              backdrop-filter: blur(8px);
              color: white;
              padding: 8px;
              text-align: center;
              font-size: 12px;
              font-weight: 500;
              border-bottom: 1px solid rgba(255,255,255,0.2);
            ">${property.state?.toLowerCase() === 'reserved' ? 'Reservado' : 'Arrendado'}</div>
          ` : ''}
        </div>
        <div style="padding: 12px;">
          <h4 style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #111;">${property.title}</h4>
          <div style="display: flex; align-items: center; gap: 4px; color: #666; font-size: 12px; margin-bottom: 8px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${property.location}
          </div>
          <div style="display: flex; gap: 12px; color: #888; font-size: 12px; margin-bottom: 10px;">
            ${property.typology ? `<span>${property.typology}</span>` : ''}
            ${property.baths > 0 ? `<span>${property.baths} WC</span>` : ''}
            ${property.area_bruta > 0 ? `<span>${property.area_bruta} m²</span>` : ''}
          </div>
          <div style="
            font-size: 18px;
            font-weight: 700;
            color: #111;
            padding-top: 8px;
            border-top: 1px solid #eee;
          ">${displayPrice}</div>
        </div>
      </div>
    `;

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: [0, -10],
      maxWidth: '300px',
      className: 'property-map-popup',
    })
      .setLngLat([property.longitude, property.latitude])
      .setHTML(popupHTML)
      .addTo(map.current);

    // Add click handler to popup
    const popupEl = popup.getElement();
    if (popupEl) {
      popupEl.style.cursor = 'pointer';
      popupEl.addEventListener('click', () => {
        if (onPropertyClick) {
          onPropertyClick(property);
        } else if (property.slug) {
          router.push(`/property/${property.slug}`);
        }
      });
    }

    popupRef.current = popup;
    setHoveredProperty(property);
  }, [router, onPropertyClick]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    flyToProperty: (propertyId: string | number) => {
      const property = properties.find(p => p.id === propertyId);
      if (!property || !property.latitude || !property.longitude || !map.current) return;

      // Cancel any pending popup hide or pending restore
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
        popupTimeoutRef.current = null;
      }
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current);
        restoreTimeoutRef.current = null;
      }

      // Save the original view only on the very first hover
      if (!preHoverView.current) {
        const center = map.current.getCenter();
        preHoverView.current = {
          center: [center.lng, center.lat],
          zoom: map.current.getZoom(),
        };
      }

      map.current.flyTo({
        center: [property.longitude, property.latitude],
        zoom: 15,
        duration: 800,
      });

      showPopup(property);
    },
    clearHighlight: () => {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      setHoveredProperty(null);

      // Delay restore so moving between cards cancels it
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current);
      }
      restoreTimeoutRef.current = setTimeout(() => {
        if (preHoverView.current && map.current) {
          map.current.flyTo({
            center: preHoverView.current.center,
            zoom: preHoverView.current.zoom,
            duration: 800,
          });
          preHoverView.current = null;
        }
        restoreTimeoutRef.current = null;
      }, 100);
    },
  }), [properties, showPopup]);

  // Draw-to-search functionality
  useEffect(() => {
    isDrawingRef.current = isDrawing;
    if (!map.current) return;
    const m = map.current;
    const canvas = m.getCanvas();

    if (isDrawing) {
      canvas.style.cursor = 'crosshair';
      m.dragPan.disable();
      m.scrollZoom.disable();
    } else {
      canvas.style.cursor = '';
      m.dragPan.enable();
      m.scrollZoom.enable();
    }
  }, [isDrawing]);

  // Handle drawing clicks on map
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (!isDrawing) return;
      const newPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      drawPointsRef.current = [...drawPointsRef.current, newPoint];
      setDrawPoints([...drawPointsRef.current]);
      updateDrawPolygon(m, drawPointsRef.current);
    };

    m.on('click', handleClick);
    return () => { m.off('click', handleClick); };
  }, [isDrawing]);

  // Update the drawing polygon on map
  const updateDrawPolygon = (m: maplibregl.Map, points: [number, number][]) => {
    const sourceId = 'draw-polygon';
    const lineSourceId = 'draw-line';

    // Update or add polygon fill
    if (points.length >= 3) {
      const polygonData: GeoJSON.Feature = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[...points, points[0]]],
        },
        properties: {},
      };

      if (m.getSource(sourceId)) {
        (m.getSource(sourceId) as maplibregl.GeoJSONSource).setData(polygonData);
      } else {
        m.addSource(sourceId, { type: 'geojson', data: polygonData });
        m.addLayer({
          id: 'draw-polygon-fill',
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#000000',
            'fill-opacity': 0.1,
          },
        });
        m.addLayer({
          id: 'draw-polygon-border',
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#000000',
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
        });
      }
    }

    // Update or add line for points < 3
    const lineData: GeoJSON.Feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: points,
      },
      properties: {},
    };

    if (m.getSource(lineSourceId)) {
      (m.getSource(lineSourceId) as maplibregl.GeoJSONSource).setData(lineData);
    } else {
      m.addSource(lineSourceId, { type: 'geojson', data: lineData });
      m.addLayer({
        id: 'draw-line-layer',
        type: 'line',
        source: lineSourceId,
        paint: {
          'line-color': '#000000',
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      });
    }

    // Add point markers
    const pointSourceId = 'draw-points';
    const pointData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: points.map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: p },
        properties: {},
      })),
    };

    if (m.getSource(pointSourceId)) {
      (m.getSource(pointSourceId) as maplibregl.GeoJSONSource).setData(pointData);
    } else {
      m.addSource(pointSourceId, { type: 'geojson', data: pointData });
      m.addLayer({
        id: 'draw-points-layer',
        type: 'circle',
        source: pointSourceId,
        paint: {
          'circle-radius': 5,
          'circle-color': '#000000',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
    }
  };

  // Finish drawing and filter
  const finishDraw = () => {
    if (drawPointsRef.current.length < 3) {
      clearDraw();
      return;
    }

    const polygon = [...drawPointsRef.current];
    setActivePolygon(polygon);
    setIsDrawing(false);

    if (onDrawFilter) {
      onDrawFilter(polygon);
    }
  };

  // Clear drawing
  const clearDraw = () => {
    setIsDrawing(false);
    setDrawPoints([]);
    drawPointsRef.current = [];
    setActivePolygon(null);

    if (map.current) {
      const m = map.current;
      ['draw-polygon-fill', 'draw-polygon-border', 'draw-line-layer', 'draw-points-layer'].forEach(id => {
        if (m.getLayer(id)) m.removeLayer(id);
      });
      ['draw-polygon', 'draw-line', 'draw-points'].forEach(id => {
        if (m.getSource(id)) m.removeSource(id);
      });
    }

    // Reset filter
    if (onDrawFilter) {
      onDrawFilter([]);
    }
  };

  // Fit to all properties
  const fitToAll = () => {
    if (!map.current) return;
    const valid = properties.filter(p => p.latitude && p.longitude);
    if (valid.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    valid.forEach(p => bounds.extend([p.longitude, p.latitude]));
    map.current.fitBounds(bounds, { padding: 80, maxZoom: 14 });
  };

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={mapContainer} className="w-full h-full rounded-2xl overflow-hidden" />

      {/* Map controls overlay — desktop: top-left, mobile: top-left below nav */}
      <div className="absolute top-3 left-3 lg:top-4 lg:left-4 flex flex-col gap-2 z-10">
        {/* Draw button */}
        {!isDrawing && !activePolygon && (
          <button
            onClick={() => {
              setIsDrawing(true);
              setDrawPoints([]);
              drawPointsRef.current = [];
            }}
            className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-3 py-2 lg:px-4 lg:py-2.5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs lg:text-sm font-medium"
          >
            <Pencil size={14} className="lg:w-4 lg:h-4" />
            <span>Desenhar área</span>
          </button>
        )}

        {/* Drawing controls */}
        {isDrawing && (
          <div className="flex flex-col gap-1.5 lg:gap-2">
            <div className="bg-white dark:bg-gray-800 px-3 py-2 lg:px-4 lg:py-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs lg:text-sm font-medium">A desenhar área ({drawPoints.length} pontos)</p>
            </div>
            <div className="flex gap-1.5 lg:gap-2">
              <button
                onClick={finishDraw}
                disabled={drawPoints.length < 3}
                className="flex items-center gap-1.5 bg-black text-white px-3 py-1.5 lg:px-4 lg:py-2 rounded-xl shadow-lg text-xs lg:text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Pesquisar
              </button>
              <button
                onClick={clearDraw}
                className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-2.5 py-1.5 lg:px-3 lg:py-2 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs lg:text-sm"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Active polygon controls */}
        {activePolygon && !isDrawing && (
          <button
            onClick={clearDraw}
            className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-3 py-2 lg:px-4 lg:py-2.5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs lg:text-sm font-medium"
          >
            <Trash2 size={14} />
            <span>Limpar área</span>
          </button>
        )}
      </div>

      {/* Fit all button — desktop only */}
      <div className="hidden lg:block absolute bottom-6 left-4 z-10">
        <button
          onClick={fitToAll}
          className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2.5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          title="Ver todos os imóveis"
        >
          <LocateFixed size={16} />
        </button>
      </div>

      {/* Property count — desktop only */}
      <div className="hidden lg:block absolute bottom-6 right-4 z-10">
        <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 text-sm font-medium">
          {properties.filter(p => p.latitude && p.longitude).length} imóveis no mapa
        </div>
      </div>

      {/* Custom popup styles */}
      <style>{`
        .property-map-popup .maplibregl-popup-content {
          padding: 0;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 30px rgba(0,0,0,0.15);
          border: 1px solid rgba(0,0,0,0.08);
        }
        .property-map-popup .maplibregl-popup-tip {
          border-top-color: white;
        }
        .property-marker {
          z-index: 1;
        }
        .property-marker:hover {
          z-index: 10;
        }
      `}</style>
    </div>
  );
});

export { pointInPolygon };
export type { MapProperty, PropertyMapViewHandle };
