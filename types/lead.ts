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
  lead?: Pick<LeadRow, 'id' | 'nome' | 'telefone' | 'telemovel' | 'email'> | null
}

// Attachment
export type LeadAttachment = LeadAttachmentRow

// Tipos de negocio
export type NegocioTipo = 'Compra' | 'Venda' | 'Compra e Venda' | 'Arrendatário' | 'Arrendador' | 'Outro'
export type NegocioEstado = 'Aberto' | 'Em progresso' | 'Fechado' | 'Cancelado'

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
  specs: {
    bedrooms: number | null
    area_util: number | null
  } | null
  cover_url: string | null
  price_flag: 'yellow' | 'orange' | null
}

// Interessado (retornado pelo endpoint de interessados)
export interface NegocioInteressado {
  negocioId: string
  firstName: string
  colleague: string
  phone: string | null
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
