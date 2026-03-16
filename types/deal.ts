// types/deal.ts

export type DealType = 'venda' | 'arrendamento' | 'trespasse'
export type DealStatus = 'draft' | 'active' | 'completed' | 'cancelled'
export type PaymentStructure = 'cpcv_only' | 'escritura_only' | 'split' | 'single'
export type PaymentMoment = 'cpcv' | 'escritura' | 'single'
export type ShareType = 'internal' | 'external' | 'network'
export type ConsultantInvoiceType = 'factura' | 'recibo_verde' | 'recibo'

export interface Deal {
  id: string
  property_id: string | null
  consultant_id: string
  proc_instance_id: string | null
  reference: string | null
  pv_number: string | null
  deal_type: DealType
  deal_value: number
  deal_date: string
  commission_pct: number
  commission_total: number
  has_share: boolean
  share_type: ShareType | null
  share_pct: number | null
  share_amount: number | null
  partner_agency_name: string | null
  partner_contact: string | null
  partner_amount: number | null
  network_pct: number | null
  network_amount: number | null
  agency_margin: number | null
  consultant_pct: number | null
  consultant_amount: number | null
  agency_net: number | null
  payment_structure: PaymentStructure
  cpcv_pct: number
  escritura_pct: number
  status: DealStatus
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // Joins
  property?: { id: string; title: string; external_ref: string } | null
  consultant?: { id: string; commercial_name: string } | null
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
  active: { label: 'Activo', color: 'bg-blue-100 text-blue-700' },
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
