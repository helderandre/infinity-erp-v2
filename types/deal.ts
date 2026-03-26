// types/deal.ts

export type DealType = 'venda' | 'arrendamento' | 'trespasse'
export type DealScenario = 'pleno' | 'comprador_externo' | 'pleno_agencia' | 'angariacao_externa'
export type DealStatus = 'draft' | 'submitted' | 'active' | 'completed' | 'cancelled'
export type PaymentStructure = 'cpcv_only' | 'escritura_only' | 'split' | 'single'
export type PaymentMoment = 'cpcv' | 'escritura' | 'single'
export type ShareType = 'internal' | 'external' | 'network' | 'external_buyer' | 'internal_agency' | 'external_agency'
export type CommissionType = 'percentage' | 'fixed'
export type ConsultantInvoiceType = 'factura' | 'recibo_verde' | 'recibo'
export type BusinessType = 'venda' | 'arrendamento' | 'trespasse'
export type PersonType = 'singular' | 'coletiva'
export type ReferralType = 'interna' | 'externa'
export type HousingRegime = 'hpp' | 'secundaria' | 'na'

export interface DealClient {
  id?: string
  deal_id?: string
  person_type: PersonType
  name: string
  email: string | null
  phone: string | null
  order_index: number
  created_at?: string
}

export interface Deal {
  id: string
  property_id: string | null
  consultant_id: string | null
  proc_instance_id: string | null
  reference: string | null
  pv_number: string | null
  remax_draft_number: string | null
  deal_type: DealScenario
  deal_value: number
  deal_date: string
  commission_type: CommissionType
  commission_pct: number
  commission_total: number
  // Partilha
  has_share: boolean
  share_type: ShareType | null
  share_pct: number | null
  share_amount: number | null
  share_notes: string | null
  partner_agency_name: string | null
  partner_contact: string | null
  partner_amount: number | null
  network_pct: number | null
  network_amount: number | null
  agency_margin: number | null
  consultant_pct: number | null
  consultant_amount: number | null
  agency_net: number | null
  // Consultor externo
  external_consultant_name: string | null
  external_consultant_phone: string | null
  external_consultant_email: string | null
  // Colega interno
  internal_colleague_id: string | null
  // Imóvel externo (cenário angariacao_externa)
  external_property_link: string | null
  external_property_id: string | null
  external_property_type: string | null
  external_property_typology: string | null
  external_property_zone: string | null
  external_property_extra: string | null
  external_property_construction_year: string | null
  // Pagamentos
  payment_structure: PaymentStructure
  cpcv_pct: number
  escritura_pct: number
  // Condições do negócio
  business_type: BusinessType | null
  deposit_value: string | null
  contract_signing_date: string | null
  max_deadline: string | null
  conditions_notes: string | null
  // Extra
  has_guarantor: boolean
  has_furniture: boolean
  is_bilingual: boolean
  has_financing: boolean
  has_financing_condition: boolean
  has_signature_recognition: boolean
  housing_regime: HousingRegime | null
  extra_info: string | null
  // Referenciação
  has_referral: boolean
  referral_pct: number | null
  referral_type: ReferralType | null
  referral_info: string | null
  // Proposta
  proposal_file_url: string | null
  proposal_file_name: string | null
  // Clientes
  clients_notes: string | null
  // Meta
  status: DealStatus
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // Joins
  property?: { id: string; title: string; external_ref: string; city?: string; listing_price?: number } | null
  consultant?: { id: string; commercial_name: string } | null
  colleague?: { id: string; commercial_name: string } | null
  clients?: DealClient[]
  payments?: DealPayment[]
}

export interface DealPayment {
  id: string
  deal_id: string
  payment_moment: PaymentMoment
  payment_pct: number
  amount: number
  network_amount: number | null
  agency_amount: number | null
  consultant_amount: number | null
  partner_amount: number | null
  is_signed: boolean
  signed_date: string | null
  is_received: boolean
  received_date: string | null
  is_reported: boolean
  reported_date: string | null
  agency_invoice_number: string | null
  agency_invoice_date: string | null
  agency_invoice_recipient: string | null
  agency_invoice_recipient_nif: string | null
  agency_invoice_amount_net: number | null
  agency_invoice_amount_gross: number | null
  agency_invoice_id: string | null
  network_invoice_number: string | null
  network_invoice_date: string | null
  consultant_invoice_number: string | null
  consultant_invoice_date: string | null
  consultant_invoice_type: ConsultantInvoiceType | null
  consultant_paid: boolean
  consultant_paid_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DealCommissionPreview {
  commission_total: number
  share_amount: number
  partner_amount: number
  network_amount: number
  agency_margin: number
  consultant_amount: number
  agency_net: number
  tier_name: string | null
  payments: {
    moment: PaymentMoment
    pct: number
    amount: number
    network: number
    agency: number
    consultant: number
    partner: number
  }[]
}

// Constants

export const DEAL_TYPES: Record<DealType, string> = {
  venda: 'Venda',
  arrendamento: 'Arrendamento',
  trespasse: 'Trespasse',
}

export const DEAL_STATUSES: Record<DealStatus, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
  submitted: { label: 'Submetido', color: 'bg-amber-100 text-amber-700' },
  active: { label: 'Ativo', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
}

export const PAYMENT_STRUCTURES: Record<PaymentStructure, string> = {
  cpcv_only: '100% no CPCV',
  escritura_only: '100% na Escritura',
  split: 'Split CPCV / Escritura',
  single: 'Momento Único',
}

export const PAYMENT_MOMENTS: Record<PaymentMoment, string> = {
  cpcv: 'CPCV',
  escritura: 'Escritura',
  single: 'Pagamento Único',
}

export const CONSULTANT_INVOICE_TYPES: Record<ConsultantInvoiceType, string> = {
  factura: 'Factura',
  recibo_verde: 'Recibo Verde',
  recibo: 'Recibo',
}

// ── Deal Closing Form Constants ──

export const DEAL_SCENARIOS: Record<DealScenario, { label: string; description: string }> = {
  pleno: { label: 'Pleno', description: 'Angariacao e comprador teus' },
  comprador_externo: { label: 'Comprador Externo', description: 'Angariacao tua e comprador externo' },
  pleno_agencia: { label: 'Pleno de Agencia', description: 'Angariacao interna e comprador teu' },
  angariacao_externa: { label: 'Angariacao Externa', description: 'Angariacao externa e comprador teu' },
}

export const BUSINESS_TYPES: Record<BusinessType, string> = {
  venda: 'Venda',
  arrendamento: 'Arrendamento',
  trespasse: 'Trespasse',
}

export const HOUSING_REGIMES: Record<HousingRegime, string> = {
  hpp: 'Habitacao Propria Permanente',
  secundaria: 'Habitacao Secundaria',
  na: 'Nao Aplicavel',
}

export const PROPERTY_TYPES_OPTIONS = [
  'Apartamento', 'Moradia', 'Quinta', 'Predio',
  'Comercio', 'Garagem', 'Terreno Urbano', 'Terreno Rustico',
] as const

export const TYPOLOGY_OPTIONS = [
  'T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7',
] as const
