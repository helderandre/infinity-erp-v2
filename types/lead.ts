import type { Database } from './database'

type LeadRow = Database['public']['Tables']['leads']['Row']
type NegocioRow = Database['public']['Tables']['negocios']['Row']
type LeadAttachmentRow = Database['public']['Tables']['lead_attachments']['Row']
type DevUser = Database['public']['Tables']['dev_users']['Row']

// Lead com agente associado (usado na listagem)
export interface LeadWithAgent extends LeadRow {
  agent?: Pick<DevUser, 'id' | 'commercial_name'> | null
}

// Negocio com lead e agente (usado na listagem de negocios)
export interface NegocioWithLead extends NegocioRow {
  lead?: {
    id: string
    nome: string
    agent_id?: string | null
    agent?: Pick<DevUser, 'id' | 'commercial_name'> | null
  } | null
}

// Negocio com lead basico (usado no detalhe do negocio)
export interface NegocioWithLeadBasic extends NegocioRow {
  lead?: Pick<LeadRow, 'id' | 'nome' | 'full_name' | 'telefone' | 'telemovel' | 'email' | 'nif' | 'data_nascimento' | 'nacionalidade' | 'morada' | 'tipo_documento' | 'numero_documento' | 'data_validade_documento' | 'pais_emissor' | 'tem_empresa' | 'empresa' | 'nipc' | 'email_empresa' | 'telefone_empresa' | 'morada_empresa' | 'documento_identificacao_url' | 'documento_identificacao_frente_url' | 'documento_identificacao_verso_url'> | null
}

// Attachment
export type LeadAttachment = LeadAttachmentRow

// Tipos de negocio
export type NegocioTipo = 'Compra' | 'Venda' | 'Compra e Venda' | 'Arrendatário' | 'Arrendador' | 'Outro'
export type NegocioEstado = 'Aberto' | 'Em Acompanhamento' | 'Em progresso' | 'Proposta' | 'Fechado' | 'Cancelado' | 'Perdido'

// Property tracking for buyer negócios
export type NegocioPropertyStatus = 'suggested' | 'sent' | 'visited' | 'interested' | 'discarded'

export interface NegocioProperty {
  id: string
  negocio_id: string
  property_id: string | null
  status: NegocioPropertyStatus
  sent_at: string | null
  visited_at: string | null
  notes: string | null
  external_url: string | null
  external_title: string | null
  external_price: number | null
  external_source: string | null
  created_at: string
  updated_at: string
  property?: {
    id: string
    title: string
    external_ref: string | null
    city: string | null
    zone: string | null
    listing_price: number | null
    slug: string | null
    property_type: string | null
    business_type: string | null
    status: string | null
    description: string | null
    address_street: string | null
    postal_code: string | null
    dev_property_specifications?: {
      bedrooms: number | null
      bathrooms: number | null
      area_gross: number | null
      area_util: number | null
      parking_spaces: number | null
      features: string[] | null
      typology: string | null
    } | null
    dev_property_media?: { url: string; is_cover: boolean; order_index: number }[]
    consultant?: {
      id: string
      commercial_name: string | null
      professional_email: string | null
      dev_consultant_profiles?: {
        profile_photo_url: string | null
        phone_commercial: string | null
        specializations: string[] | null
      } | null
    } | null
  }
}

// Match de imovel (retornado pelo endpoint de matches)
export interface PropertyMatch {
  id: string
  title: string
  slug: string
  listing_price: number | null
  property_type: string | null
  status: string | null
  city: string | null
  zone: string | null
  description: string | null
  energy_certificate: string | null
  property_condition: string | null
  specs: {
    bedrooms: number | null
    bathrooms: number | null
    area_gross: number | null
    area_util: number | null
    parking_spaces: number | null
    construction_year: number | null
    has_elevator: boolean | null
    features: string[] | null
  } | null
  media: { url: string; is_cover: boolean }[]
  cover_url: string | null
  price_flag: 'yellow' | 'orange' | null
  /** Modo de match geográfico (spatial / fallback / legacy / no_filter) */
  geo_source: 'spatial' | 'text_fallback' | 'localizacao_legacy' | 'no_filter'
  /** Badges flexíveis (amenities, área, estado, localização aproximada) */
  badges: { type: 'positive' | 'warning' | 'info'; key: string; label: string }[]
  consultant: {
    id: string
    commercial_name: string
    phone: string | null
    email: string | null
  } | null
}

// Interessado (retornado pelo endpoint de interessados)
export interface NegocioInteressado {
  negocioId: string
  firstName: string
  colleague: string
  phone: string | null
  email: string | null
}

// Resposta do chat IA
export interface ChatResponse {
  reply: string
  fields: Record<string, unknown>
}

// Resultado da analise de documento
export interface DocumentAnalysis {
  tipo_documento: string | null
  numero_documento: string | null
  full_name: string | null
  nif: string | null
  data_nascimento: string | null
  data_validade_documento: string | null
  nacionalidade: string | null
  pais_emissor: string | null
  genero: string | null
}
