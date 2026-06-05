/**
 * Tipos partilhados pelo sistema de matching de imóveis ↔ negócios.
 *
 * Os bloqueantes (tipo, preço, quartos, WC, geografia) são aplicados em SQL
 * via `match_properties_for_negocio()`. Os flexíveis (amenities, área, estado)
 * são calculados aqui e devolvidos como `badges`.
 */

export type BadgeType = 'positive' | 'warning' | 'info'

export interface MatchBadge {
  /** Tipo da badge — determina cor e se conta para o modo "estrito". */
  type: BadgeType
  /** Identificador estável para programação (ex.: 'piscina', 'area_util'). */
  key: string
  /** Texto curto a mostrar no card. */
  label: string
}

/**
 * Origem do match geográfico, devolvido pela função SQL.
 * Determina se mostramos badge `⚠ Localização aproximada` (info, não warning).
 */
export type GeoSource =
  | 'spatial'              // ST_Contains com lat/lng exactos
  | 'text_fallback'        // Imóvel sem coords; match contra zone/parish/city
  | 'localizacao_legacy'   // Negócio sem zonas; legacy `localizacao` text
  | 'no_filter'            // Negócio sem zonas nem localizacao

/**
 * Inputs do negócio relevantes para os flexíveis.
 * Mapeia 1-para-1 colunas de `negocios`.
 */
export interface NegocioMatchInput {
  area_min_m2?: number | null
  estado_imovel?: string | null
  tem_garagem?: boolean | null
  tem_estacionamento?: boolean | null
  tem_elevador?: boolean | null
  tem_piscina?: boolean | null
  tem_varanda?: boolean | null
  tem_arrumos?: boolean | null
  tem_exterior?: boolean | null
  tem_porteiro?: boolean | null
}

/**
 * Inputs do imóvel relevantes para os flexíveis.
 * Vem de `dev_properties` + `dev_property_specifications`.
 */
export interface PropertyMatchInput {
  property_condition?: string | null
  specifications?: {
    area_util?: number | null
    area_gross?: number | null
    bedrooms?: number | null
    bathrooms?: number | null
    has_elevator?: boolean | null
    garage_spaces?: number | null
    parking_spaces?: number | null
    balcony_area?: number | null
    pool_area?: number | null
    attic_area?: number | null
    pantry_area?: number | null
    features?: string[] | null
    equipment?: string[] | null
  } | null
}

export interface MatchResult {
  property_id: string
  geo_source: GeoSource
  badges: MatchBadge[]
}
