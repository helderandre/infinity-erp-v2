// ─── IMPIC Compliance Types ─────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high'
export type PepResult = 'clean' | 'flagged' | 'pending'
export type PaymentMethod = 'transfer' | 'cheque' | 'cash' | 'mixed'
export type ComplianceStatus = 'pending' | 'complete' | 'flagged'

export interface DealCompliance {
  id: string
  deal_id: string
  // KYC Buyer
  buyer_name: string | null
  buyer_nif: string | null
  buyer_cc_number: string | null
  buyer_nationality: string | null
  buyer_address: string | null
  buyer_pep_check: boolean
  buyer_pep_result: PepResult | null
  buyer_risk_level: RiskLevel
  buyer_funds_origin: string | null
  buyer_funds_declared: boolean
  buyer_id_doc_url: string | null
  buyer_address_proof_url: string | null
  buyer_docs_complete: boolean
  // KYC Seller
  seller_name: string | null
  seller_nif: string | null
  seller_cc_number: string | null
  seller_nationality: string | null
  seller_address: string | null
  seller_pep_check: boolean
  seller_pep_result: PepResult | null
  seller_risk_level: RiskLevel
  seller_is_company: boolean
  seller_company_cert_url: string | null
  seller_beneficial_owner: string | null
  seller_id_doc_url: string | null
  seller_address_proof_url: string | null
  seller_docs_complete: boolean
  // Transaction
  payment_method: PaymentMethod | null
  cash_amount: number
  risk_flags: string[]
  overall_risk_level: RiskLevel
  // IMPIC
  impic_reported: boolean
  impic_report_date: string | null
  impic_reference: string | null
  impic_quarter: string | null
  impic_notes: string | null
  // Suspicious
  suspicious_activity_reported: boolean
  suspicious_activity_date: string | null
  suspicious_activity_ref: string | null
  // Status
  status: ComplianceStatus
  created_at: string
  updated_at: string
}

// Quarterly deadlines
export const IMPIC_DEADLINES: Record<string, { quarter: string; deadline: string }> = {
  Q1: { quarter: 'Jan-Mar', deadline: '30 de Junho' },
  Q2: { quarter: 'Abr-Jun', deadline: '30 de Setembro' },
  Q3: { quarter: 'Jul-Set', deadline: '31 de Dezembro' },
  Q4: { quarter: 'Out-Dez', deadline: '31 de Março (ano seguinte)' },
}

export const RISK_LEVELS: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: 'Baixo', color: 'bg-emerald-100 text-emerald-700' },
  medium: { label: 'Médio', color: 'bg-amber-100 text-amber-700' },
  high: { label: 'Elevado', color: 'bg-red-100 text-red-700' },
}

export const PEP_RESULTS: Record<PepResult, { label: string; color: string }> = {
  clean: { label: 'Limpo', color: 'bg-emerald-100 text-emerald-700' },
  flagged: { label: 'Sinalizado', color: 'bg-red-100 text-red-700' },
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700' },
}

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  transfer: 'Transferência Bancária',
  cheque: 'Cheque',
  cash: 'Numerário',
  mixed: 'Misto',
}

export const COMPLIANCE_STATUSES: Record<ComplianceStatus, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700' },
  complete: { label: 'Completo', color: 'bg-emerald-100 text-emerald-700' },
  flagged: { label: 'Sinalizado', color: 'bg-red-100 text-red-700' },
}

// Risk flags that can be auto-detected
export const RISK_FLAGS: Record<string, { label: string; severity: RiskLevel }> = {
  cash_over_15k: { label: 'Numerário > 15.000€', severity: 'high' },
  cash_payment: { label: 'Pagamento parcial em numerário', severity: 'medium' },
  high_risk_country: { label: 'País de alto risco (GAFI)', severity: 'high' },
  pep_buyer: { label: 'Comprador é PEP', severity: 'high' },
  pep_seller: { label: 'Vendedor é PEP', severity: 'high' },
  value_anomaly: { label: 'Valor anómalo para a zona', severity: 'medium' },
  missing_docs_buyer: { label: 'Documentação comprador incompleta', severity: 'medium' },
  missing_docs_seller: { label: 'Documentação vendedor incompleta', severity: 'medium' },
  funds_not_declared: { label: 'Origem dos fundos não declarada', severity: 'high' },
  no_nif_buyer: { label: 'Comprador sem NIF', severity: 'medium' },
  no_nif_seller: { label: 'Vendedor sem NIF', severity: 'medium' },
}

// High-risk countries (GAFI grey/black list — simplified)
export const HIGH_RISK_COUNTRIES = [
  'Irão', 'Coreia do Norte', 'Myanmar', 'Síria', 'Afeganistão',
  'Iémen', 'Haiti', 'Moçambique', 'Nigéria', 'Paquistão',
]

// IMPIC form field mapping for copy-paste helper
export interface ImpicFormData {
  // Mediador
  ami_license: string
  agency_name: string
  consultant_name: string
  // Imóvel
  property_type: string
  property_address: string
  property_parish: string
  property_city: string
  property_postal_code: string
  // Transacção
  transaction_type: string
  transaction_value: number
  transaction_date: string
  payment_method: string
  // Comprador
  buyer_name: string
  buyer_nif: string
  buyer_cc: string
  buyer_nationality: string
  buyer_address: string
  // Vendedor
  seller_name: string
  seller_nif: string
  seller_cc: string
  seller_nationality: string
  seller_address: string
}
