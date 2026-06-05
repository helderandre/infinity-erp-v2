export type FichaSource = 'digital' | 'scan' | 'manual'
export type DiscoverySource = 'internet' | 'magazine' | 'sign' | 'storefront' | 'flyers' | 'agent' | 'other'

export interface VisitFicha {
  id: string
  property_id: string
  visit_id: string | null
  source: FichaSource
  client_name: string | null
  client_phone: string | null
  client_email: string | null
  client_id_number: string | null
  visit_date: string | null
  visit_time: string | null
  rating_floorplan: number | null
  rating_construction: number | null
  rating_finishes: number | null
  rating_sun_exposition: number | null
  rating_location: number | null
  rating_value: number | null
  rating_overall: number | null
  rating_agent_service: number | null
  liked_most: string | null
  liked_least: string | null
  would_buy: boolean | null
  would_buy_reason: string | null
  perceived_value: number | null
  has_property_to_sell: boolean | null
  discovery_source: DiscoverySource | null
  signature_url: string | null
  consent_share_with_owner: boolean
  scan_image_url: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export const RATING_FIELDS = [
  { key: 'rating_floorplan', label: 'Planta do Imóvel' },
  { key: 'rating_construction', label: 'Qualidade de Construção' },
  { key: 'rating_finishes', label: 'Acabamentos' },
  { key: 'rating_sun_exposition', label: 'Exposição Solar' },
  { key: 'rating_location', label: 'Localização' },
  { key: 'rating_value', label: 'Valor' },
  { key: 'rating_overall', label: 'Apreciação Global' },
  { key: 'rating_agent_service', label: 'Serviço do Agente' },
] as const

export const DISCOVERY_OPTIONS = [
  { value: 'internet', label: 'Internet' },
  { value: 'magazine', label: 'Revista' },
  { value: 'sign', label: 'Placa de Venda' },
  { value: 'storefront', label: 'Montra de Loja' },
  { value: 'flyers', label: 'Folhetos' },
  { value: 'agent', label: 'Agente' },
  { value: 'other', label: 'Outro' },
] as const

export interface FichaDashboardStats {
  totalFichas: number
  avgRatings: Record<string, number>
  wouldBuyPct: number
  avgPerceivedValue: number | null
  hasPropertyToSellPct: number
  discoveryBreakdown: Record<string, number>
  sourceBreakdown: Record<string, number>
}
