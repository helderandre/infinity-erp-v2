export type AcompanhamentoStatus = 'active' | 'paused' | 'converted' | 'lost'
export type SuggestedPropertyStatus = 'suggested' | 'sent' | 'visited' | 'interested' | 'discarded'

export interface Acompanhamento {
  id: string
  negocio_id: string
  lead_id: string
  consultant_id: string

  status: AcompanhamentoStatus
  lost_reason: string | null

  // Credit (additional to negócio)
  pre_approval_amount: number | null
  credit_intermediation: boolean
  credit_entity: string | null
  credit_notes: string | null

  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface AcompanhamentoWithRelations extends Acompanhamento {
  lead?: {
    id: string
    nome: string
    full_name: string | null
    email: string | null
    telemovel: string | null
  }
  consultant?: {
    id: string
    commercial_name: string | null
  }
  negocio?: {
    id: string
    tipo: string
    estado: string | null
    orcamento: number | null
    orcamento_max: number | null
    localizacao: string | null
    quartos_min: number | null
    tipo_imovel: string | null
    classe_imovel: string | null
    estado_imovel: string | null
    motivacao_compra: string | null
    prazo_compra: string | null
    tem_garagem: boolean | null
    tem_elevador: boolean | null
    tem_exterior: boolean | null
    tem_piscina: boolean | null
    credito_pre_aprovado: boolean | null
    capital_proprio: number | null
    valor_credito: number | null
    financiamento_necessario: boolean | null
    casas_banho: number | null
    observacoes: string | null
  }
}

export interface AcompanhamentoProperty {
  id: string
  acompanhamento_id: string
  property_id: string | null
  status: SuggestedPropertyStatus
  sent_at: string | null
  visited_at: string | null
  notes: string | null
  created_at: string

  // External property (not in CRM)
  external_url: string | null
  external_title: string | null
  external_price: number | null
  external_source: string | null  // idealista, imovirtual, casa_sapo, etc.
  property?: {
    id: string
    title: string
    external_ref: string | null
    city: string | null
    zone: string | null
    listing_price: number | null
    slug: string | null
    property_type: string | null
    dev_property_specifications?: {
      bedrooms: number | null
      area_util: number | null
    } | null
    dev_property_media?: Array<{
      url: string
      is_cover: boolean
    }> | null
  }
}

export interface AcompanhamentoFilters {
  status?: AcompanhamentoStatus
  consultant_id?: string
  search?: string
}
