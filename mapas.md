# Map + Draw Property Search — Implementation Spec

This document describes a "search properties on a map, optionally by drawing a polygon" feature, implemented in a sister React project. Use this as a spec to port the same UX into this ERP.

The reference implementation uses **MapLibre GL JS** (free, no API key, OpenStreetMap-based tiles) and React. No Mapbox token is required.

---

## 1. Feature summary

The user lands on a split-screen page:

- **Left (desktop) / bottom (mobile)**: a list of property cards.
- **Right (desktop) / top (mobile)**: an interactive map with one custom marker per property (the marker is a price pill, black for sale / indigo for rent).

Behaviors:

1. **Hover a card → map flies to that property** and shows a rich popup card. Leaving the card flies the map back to the previous view.
2. **Hover a marker → popup card appears** with image, title, location, typology/area, price.
3. **Click a marker / popup / card → opens the property modal** (or navigates to detail).
4. **"Desenhar área" button → polygon draw mode**:
   - Crosshair cursor, panning + scroll-zoom disabled.
   - Each click adds a vertex; a dashed line connects vertices, dots mark them, and once ≥3 vertices exist, a translucent black fill renders.
   - "Pesquisar" finishes drawing → properties outside the polygon are filtered out.
   - "Limpar área" clears the polygon and restores the full list.
5. **When a polygon is active**, results are sorted **inside-polygon first**. Cards outside are dimmed (`opacity-40`).
6. **All sidebar filters** (zone, type, typology, price, area, condition) compose with the polygon filter — they're independent.

---

## 2. Dependencies

```bash
npm install maplibre-gl
```

```ts
// at the top of the map component
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
```

That's it. Tiles come from a free CARTO basemap, no API key:

```ts
const TILE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
```

If the ERP needs a different look (dark, satellite), swap the style URL — MapTiler, Stadia, and CARTO all publish free GL styles.

---

## 3. Data shape

Each property passed to the map needs at minimum:

```ts
interface MapProperty {
  id: number | string;
  title: string;
  location: string;        // human-readable, e.g. "Lisboa, Portugal"
  price: string;           // formatted, e.g. "€450.000" or "€1.200/mês" — used as marker label
  priceValue: number;      // numeric, for filtering
  image: string;           // cover URL for the hover popup
  beds: number;
  baths: number;
  area_bruta: number;      // m²
  type: 'sale' | 'rent';   // controls marker color
  typology?: string;       // e.g. "T2"
  propertyType?: string;
  externalRef?: string;
  state?: string;          // 'active' | 'reserved' | 'sold' | 'rented'
  slug?: string;
  latitude: number;
  longitude: number;
}
```

In the ERP, derive these from your property table. **Latitude and longitude are required** to render on the map; properties without coords should still show in the list (mark them with a "Sem mapa" badge as in the reference impl) but be skipped from `mapProperties`.

---

## 4. Architecture

Two components, clear separation:

```
PropertyMapPage          ← page-level: data fetching, sidebar, filters, list
└── PropertyMapView      ← presentational: map, markers, popups, draw tool
```

`PropertyMapView` exposes an imperative handle via `useImperativeHandle`:

```ts
export interface PropertyMapViewHandle {
  flyToProperty: (propertyId: string | number) => void;
  clearHighlight: () => void;
}
```

`PropertyMapPage` holds a `mapRef` and calls `mapRef.current?.flyToProperty(id)` from card `onMouseEnter`, and `clearHighlight()` from `onMouseLeave`. This keeps the map dumb and the page in charge of which property is "active".

Props the page passes down:

```ts
<PropertyMapView
  ref={mapRef}
  properties={mapProperties}                    // already filtered + sorted
  onPropertyClick={handlePropertyClick}         // open modal / navigate
  onDrawFilter={(polygon) => setDrawPolygon(polygon)}  // [] when cleared
/>
```

---

## 5. The point-in-polygon test

Standard ray-casting algorithm. Pure function, no dependencies:

```ts
export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
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
```

Coordinate convention: **`[longitude, latitude]`** for both `point` and each polygon vertex. This matches MapLibre's `LngLat` order — keep it consistent everywhere or you will get nonsense filtering.

In the page, filter with:

```ts
if (drawPolygon.length >= 3 && property.latitude && property.longitude) {
  if (!pointInPolygon([property.longitude, property.latitude], drawPolygon)) return false;
}
```

And sort inside-first:

```ts
const sorted = [...filtered].sort((a, b) => {
  if (drawPolygon.length >= 3) {
    const aIn = isInsideDrawArea(a);
    const bIn = isInsideDrawArea(b);
    if (aIn && !bIn) return -1;
    if (!aIn && bIn) return 1;
  }
  return /* your secondary sort */;
});
```

---

## 6. Map initialization

```tsx
const mapContainer = useRef<HTMLDivElement>(null);
const map = useRef<maplibregl.Map | null>(null);

useEffect(() => {
  if (!mapContainer.current || map.current) return;

  map.current = new maplibregl.Map({
    container: mapContainer.current,
    style: TILE_URL,
    center: [-9.14, 38.74],   // adjust to your default city
    zoom: 11,
    attributionControl: true,
  });

  map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

  return () => {
    map.current?.remove();
    map.current = null;
  };
}, []);
```

`StrictMode` double-invokes effects in dev — the `if (map.current) return;` guard is required.

---

## 7. Custom markers (price pills)

Don't use MapLibre's default marker. Build an HTML element so you can style + animate it cheaply:

```tsx
markersRef.current.forEach(m => m.remove());
markersRef.current = [];

properties.forEach(property => {
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
      border: 2px solid white;
      transition: transform 0.15s, box-shadow 0.15s;
    ">${property.price}</div>
  `;

  el.addEventListener('click', (e) => {
    if (isDrawingRef.current) return;          // don't trigger clicks while drawing
    e.stopPropagation();
    onPropertyClick?.(property);
  });

  // hover handlers (skip on touch devices)
  if (!window.matchMedia('(pointer: coarse)').matches) {
    el.addEventListener('mouseenter', () => showPopup(property));
    el.addEventListener('mouseleave', () => schedulePopupHide());
  }

  const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([property.longitude, property.latitude])
    .addTo(map.current!);

  markersRef.current.push(marker);
});
```

**Always clear `markersRef` before re-adding** when `properties` changes, otherwise stale markers accumulate.

---

## 8. Hover popup card

A `maplibregl.Popup` with `closeButton: false`, `closeOnClick: false`, and an HTML body. Key details:

- Use `setTimeout` of ~300ms to delay hiding so the user can move the cursor from the marker into the popup without it disappearing.
- Make the popup itself clickable: after `popup.addTo(map)`, grab `popup.getElement()` and attach a click handler that opens the modal / navigates.
- Show "Reservado" / "Arrendado" overlay when `state` is `'reserved'` or `'rented'`, and replace the price with "Sob Consulta".

See `src/app/components/PropertyMapView.tsx`'s `showPopup` for the full HTML template.

---

## 9. flyToProperty + restore behavior

The trick that makes the hover-sync feel right: **save the user's view exactly once when the first hover happens**, then restore it after they've stopped hovering for ~100ms (debounced so moving between cards doesn't snap back).

```tsx
const preHoverView = useRef<{ center: [number, number]; zoom: number } | null>(null);
const restoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useImperativeHandle(ref, () => ({
  flyToProperty: (propertyId) => {
    const property = properties.find(p => p.id === propertyId);
    if (!property?.latitude || !property?.longitude || !map.current) return;

    if (restoreTimeoutRef.current) clearTimeout(restoreTimeoutRef.current);

    // Save view ONLY on first hover of a sequence
    if (!preHoverView.current) {
      const c = map.current.getCenter();
      preHoverView.current = { center: [c.lng, c.lat], zoom: map.current.getZoom() };
    }

    map.current.flyTo({
      center: [property.longitude, property.latitude],
      zoom: 15,
      duration: 800,
    });
    showPopup(property);
  },
  clearHighlight: () => {
    popupRef.current?.remove();
    popupRef.current = null;

    if (restoreTimeoutRef.current) clearTimeout(restoreTimeoutRef.current);
    restoreTimeoutRef.current = setTimeout(() => {
      if (preHoverView.current && map.current) {
        map.current.flyTo({
          center: preHoverView.current.center,
          zoom: preHoverView.current.zoom,
          duration: 800,
        });
        preHoverView.current = null;
      }
    }, 100);
  },
}), [properties]);
```

---

## 10. Polygon drawing

State (refs are needed because MapLibre event handlers close over stale React state):

```tsx
const [isDrawing, setIsDrawing] = useState(false);
const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
const [activePolygon, setActivePolygon] = useState<[number, number][] | null>(null);

const drawPointsRef = useRef<[number, number][]>([]);
const isDrawingRef = useRef(false);
```

Toggle interaction when entering/leaving draw mode:

```tsx
useEffect(() => {
  isDrawingRef.current = isDrawing;
  if (!map.current) return;
  const m = map.current;
  if (isDrawing) {
    m.getCanvas().style.cursor = 'crosshair';
    m.dragPan.disable();
    m.scrollZoom.disable();
  } else {
    m.getCanvas().style.cursor = '';
    m.dragPan.enable();
    m.scrollZoom.enable();
  }
}, [isDrawing]);
```

Capture each click as a vertex:

```tsx
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
```

Render the in-progress geometry as three GeoJSON sources/layers (`draw-polygon`, `draw-line`, `draw-points`). When ≥3 points exist, close the polygon by appending `points[0]` to the coordinate ring. See `updateDrawPolygon` in the reference file for the full source/layer setup.

When the user clicks "Pesquisar":

```tsx
const finishDraw = () => {
  if (drawPointsRef.current.length < 3) { clearDraw(); return; }
  const polygon = [...drawPointsRef.current];
  setActivePolygon(polygon);
  setIsDrawing(false);
  onDrawFilter?.(polygon);            // page applies the filter
};
```

When "Limpar área":

```tsx
const clearDraw = () => {
  setIsDrawing(false);
  setDrawPoints([]);
  drawPointsRef.current = [];
  setActivePolygon(null);

  if (map.current) {
    const m = map.current;
    ['draw-polygon-fill', 'draw-polygon-border', 'draw-line-layer', 'draw-points-layer']
      .forEach(id => m.getLayer(id) && m.removeLayer(id));
    ['draw-polygon', 'draw-line', 'draw-points']
      .forEach(id => m.getSource(id) && m.removeSource(id));
  }
  onDrawFilter?.([]);                 // tell the page to drop the polygon filter
};
```

---

## 11. Page-level state shape

In `PropertyMapPage` (or whatever you call the ERP equivalent):

```tsx
const [drawPolygon, setDrawPolygon] = useState<[number, number][]>([]);
const [advancedFilters, setAdvancedFilters] = useState<any>({});
const [filter, setFilter] = useState<'all' | 'sale' | 'rent'>('all');
const [hoveredCardId, setHoveredCardId] = useState<string | number | null>(null);
const mapRef = useRef<PropertyMapViewHandle>(null);
```

The filtered list is a `useMemo` over `(allProperties, filter, urlFilters, advancedFilters, drawPolygon)`. The list passed to the map is the same list, just with `latitude && longitude` required:

```tsx
const mapProperties = sortedProperties.filter(p => p.latitude && p.longitude);
```

---

## 12. Layout

The reference uses `lg:` Tailwind breakpoints to switch:

- **Mobile (`<lg`)**: vertical stack — top bar, 40vh map, 2-col grid of compact cards. Filters open in a bottom-sheet portal.
- **Desktop (`≥lg`)**: 320–340px sidebar (with a "Filtros / Lista" tab toggle) on the left, map fills the rest.

This is a UX preference; pick whatever fits the ERP's layout system, but keep the **list + map side-by-side on desktop** rule — it's what makes the hover sync useful.

---

## 13. Implementation checklist for the ERP

- [ ] `npm install maplibre-gl`
- [ ] Decide where in the ERP this lives (e.g. `app/dashboard/properties/map/page.tsx` for Next.js).
- [ ] Add `lat`/`lng` columns to your property table if missing; backfill from address geocoding if needed.
- [ ] Build the `PropertyMapView` component (markers + popup + draw tool + imperative handle).
- [ ] Build the page: data fetch → filter → map + list, hover-sync via `mapRef`.
- [ ] Wire `onDrawFilter` to update a `drawPolygon` state, and add the polygon check inside your existing `useMemo` filter pipeline so it composes with all other filters.
- [ ] Sort inside-polygon-first when `drawPolygon.length >= 3`.
- [ ] Dim cards outside the polygon (`opacity-40`).
- [ ] Skip the click-through-to-modal when `isDrawingRef.current` is true (prevents accidental opens while drawing).
- [ ] Test on touch: hover handlers must be skipped (`window.matchMedia('(pointer: coarse)').matches`); rely on tap-to-open instead.

---

## 14. Reference files

The full working implementation lives in the sister project at:

- `src/app/components/PropertyMapView.tsx` — the map component (~630 lines, complete)
- `src/app/pages/PropertyMapPage.tsx` — the page wrapper (~920 lines, includes the full sidebar filter panel + bottom-sheet)

When in doubt about an interaction, copy from those files directly. They are battle-tested in production.
