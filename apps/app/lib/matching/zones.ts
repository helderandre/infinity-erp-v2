/**
 * Tipos partilhados pelas zonas de interesse de um negócio.
 *
 * Persistidas em `negocios.zonas` (JSONB array). O trigger SQL
 * `negocios_recompute_zonas_geom` recalcula `negocios.zonas_geom`
 * sempre que este campo muda.
 */

export type AdminAreaType = 'distrito' | 'concelho' | 'freguesia'

export interface NegocioZoneAdmin {
  kind: 'admin'
  /** UUID em admin_areas */
  area_id: string
  /** Texto a mostrar no chip e no autocomplete (ex.: "Cascais (Concelho)") */
  label: string
}

export interface NegocioZonePolygon {
  kind: 'polygon'
  /** UUID gerado client-side (não bate em DB; é só para keys de UI) */
  id: string
  label: string
  /** GeoJSON Polygon (não MultiPolygon) */
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

export type NegocioZone = NegocioZoneAdmin | NegocioZonePolygon

/** Resposta da API /api/admin-areas/search */
export interface AdminAreaSearchResult {
  id: string
  type: AdminAreaType
  name: string
  parent_id: string | null
  /** Nome do pai para mostrar contexto (ex.: "Cascais" para freguesia "Estoril") */
  parent_label: string | null
}

/** Constrói label legível a partir de um resultado de pesquisa */
export function adminAreaLabel(r: AdminAreaSearchResult): string {
  const typeLabel = r.type === 'distrito' ? 'Distrito' : r.type === 'concelho' ? 'Concelho' : 'Freguesia'
  if (r.parent_label) {
    return `${r.name} (${typeLabel}, ${r.parent_label})`
  }
  return `${r.name} (${typeLabel})`
}
