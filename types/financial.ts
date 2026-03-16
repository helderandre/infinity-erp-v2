// ─── Transaction Types ──────────────────────────────────────────────────────

export type TransactionType = 'commission_sale' | 'commission_rent' | 'commission_split' | 'marketing_purchase' | 'salary' | 'expense'
export type TransactionStatus = 'pending' | 'approved' | 'paid' | 'cancelled'
export type ShareType = 'internal' | 'external' | 'network'

export interface FinancialTransaction {
  id: string
  consultant_id: string
  property_id: string | null
  proc_instance_id: string | null
  transaction_type: TransactionType
  category: string | null
  deal_value: number | null
  agency_commission_pct: number | null
  agency_commission_amount: number | null
  consultant_split_pct: number | null
  consultant_commission_amount: number | null
  is_shared_deal: boolean
  share_type: ShareType | null
  share_agency_name: string | null
  share_pct: number | null
  share_amount: number | null
  status: TransactionStatus
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null
  payment_reference: string | null
  transaction_date: string
  reporting_month: string
  description: string | null
  notes: string | null
  created_at: string
  updated_at: string
  consultant?: { id: string; commercial_name: string } | null
  property?: { id: string; title: string; external_ref: string; listing_price: number } | null
}

export interface CommissionTier {
  id: string
  name: string
  business_type: 'venda' | 'arrendamento'
  min_value: number
  max_value: number | null
  agency_rate: number
  consultant_rate: number
  is_active: boolean
  order_index: number
  created_at: string
  updated_at: string
}

export interface AgencySetting {
  id: string
  key: string
  value: string
  description: string | null
  updated_at: string
}

// ─── Dashboard Types ────────────────────────────────────────────────────────

export interface ManagementDashboard {
  forecasts: {
    expected_acquisitions: number
    pending_acquisitions: number
    expected_deals: number
    active_deals: number
    expected_revenue: number
    expected_margin: number
  }
  acquisitions: {
    new_this_month: number
    active: number
    days_without_acquisition: number
    last_acquisition_title: string | null
    last_acquisition_date: string | null
    last_acquisition_id: string | null
    acquired: number
    reserved: number
    sold: number
    cancelled: number
  }
  reporting: {
    reported_this_month: number
    signed_pending: number
    reported_this_year: number
  }
  margin: {
    margin_this_month: number
    pending_collection: number
    margin_this_year: number
  }
  portfolio: {
    active_volume: number
    potential_revenue: number
  }
}

export interface RevenuePipelineItem {
  stage: string
  label: string
  probability: number
  total_value: number
  weighted_value: number
  count: number
}

export interface PerformanceAlert {
  consultant_id: string
  consultant_name: string
  type: 'no_acquisitions' | 'below_target' | 'no_activity' | 'annual_risk'
  severity: 'warning' | 'urgent'
  message: string
  value?: number
  target?: number
}

export interface AgentDashboard {
  revenue_ytd: number
  revenue_this_month: number
  annual_target: number
  pct_achieved: number
  ranking_position: number
  total_agents: number
  my_properties: {
    active: number
    reserved: number
    sold_year: number
    volume: number
  }
  upcoming_actions: UpcomingAction[]
  vs_average: VsAverageItem[]
  monthly_evolution: { month: string; revenue: number; target: number }[]
}

export interface UpcomingAction {
  type: 'visit' | 'cpcv' | 'escritura' | 'contract_expiry' | 'lead_followup'
  title: string
  date: string
  property_ref?: string
  link?: string
}

export interface VsAverageItem {
  metric: string
  my_value: number
  agency_avg: number
  direction: 'above' | 'below' | 'equal'
}

export interface AgentRanking {
  position: number
  consultant_id: string
  consultant_name: string
  value: number
  target: number | null
  pct_achieved: number | null
  variation_vs_previous: number | null
  new_this_month?: number
  active?: number
  sold?: number
}

// ─── Report Types ───────────────────────────────────────────────────────────

export interface AgentAnalysisReport {
  agent: {
    name: string
    agency: string
    id_number: string
    entry_date: string
    tier: string
    ranking_position: number
  }
  objective: {
    forecast: number
    in_value: number
    growth_pct: number
  }
  monthly_comparison: MonthlyComparison[]
  totals: MonthlyComparisonTotals
  summary: AgentSummary
  trends: {
    billing: TrendIndicator
    productivity: TrendIndicator
    new_acquisitions: TrendIndicator
    total_acquisitions: TrendIndicator
  }
}

export interface MonthlyComparison {
  month: string
  billing_prev: number
  billing_curr: number
  new_acq_prev: number
  new_acq_curr: number
  total_acq_prev: number
  total_acq_curr: number
  productivity_prev: number
  productivity_curr: number
  quarter_avg: number
  transactions_prev: number
  transactions_curr: number
}

export interface MonthlyComparisonTotals {
  billing_prev: number
  billing_curr: number
  new_acq_prev: number
  new_acq_curr: number
  total_acq_prev: number
  total_acq_curr: number
  productivity_prev: number
  productivity_curr: number
  transactions_prev: number
  transactions_curr: number
}

export interface AgentSummary {
  total_acquisitions: number
  sale_count: number
  rent_count: number
  internal_shares_pct: number
  external_shares_pct: number
  network_shares_pct: number
  ytd_current: number
  ytd_previous: number
  ytd_diff: number
  sale_acq_amount: number
  sale_acq_pct: number
  sale_sold_amount: number
  sale_sold_pct: number
}

export interface TrendIndicator {
  direction: 'up' | 'down' | 'equal'
  value: number
}

export interface CustomReportConfig {
  dimensions: ReportDimension[]
  metrics: ReportMetric[]
  filters: ReportFilters
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type ReportDimension = 'consultant' | 'month' | 'quarter' | 'year' | 'property_type' | 'business_type' | 'city' | 'price_tier'
export type ReportMetric = 'revenue' | 'transactions' | 'acquisitions' | 'commission_agency' | 'commission_consultant' | 'time_to_sale' | 'volume' | 'productivity'

export interface ReportFilters {
  consultant_id?: string
  date_from?: string
  date_to?: string
  business_type?: string
  property_type?: string
  city?: string
  status?: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const TRANSACTION_TYPES: Record<TransactionType, string> = {
  commission_sale: 'Comissão Venda',
  commission_rent: 'Comissão Arrendamento',
  commission_split: 'Partilha de Comissão',
  marketing_purchase: 'Compra Marketing',
  salary: 'Salário',
  expense: 'Despesa',
}

export const TRANSACTION_STATUSES: Record<TransactionStatus, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Aprovado', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Pago', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
}

export const SHARE_TYPES: Record<ShareType, string> = {
  internal: 'Partilha Interna',
  external: 'Partilha Externa',
  network: 'Partilha na Rede',
}

export const REPORT_DIMENSIONS: Record<ReportDimension, string> = {
  consultant: 'Consultor',
  month: 'Mês',
  quarter: 'Trimestre',
  year: 'Ano',
  property_type: 'Tipo de Imóvel',
  business_type: 'Tipo de Negócio',
  city: 'Cidade',
  price_tier: 'Escalão de Preço',
}

export const REPORT_METRICS: Record<ReportMetric, string> = {
  revenue: 'Facturação',
  transactions: 'Transacções',
  acquisitions: 'Angariações',
  commission_agency: 'Comissão Agência',
  commission_consultant: 'Comissão Consultor',
  time_to_sale: 'Tempo Médio de Venda',
  volume: 'Volume em Carteira',
  productivity: 'Produtividade',
}

export const PERFORMANCE_ALERT_TYPES: Record<PerformanceAlert['type'], { label: string; icon: string }> = {
  no_acquisitions: { label: 'Sem Angariações', icon: 'AlertTriangle' },
  below_target: { label: 'Abaixo do Objectivo', icon: 'TrendingDown' },
  no_activity: { label: 'Sem Actividade', icon: 'Clock' },
  annual_risk: { label: 'Meta Anual em Risco', icon: 'AlertOctagon' },
}

export const UPCOMING_ACTION_TYPES: Record<UpcomingAction['type'], { label: string; icon: string }> = {
  visit: { label: 'Visita', icon: 'MapPin' },
  cpcv: { label: 'CPCV', icon: 'FileSignature' },
  escritura: { label: 'Escritura', icon: 'FileCheck' },
  contract_expiry: { label: 'Contrato a Expirar', icon: 'CalendarClock' },
  lead_followup: { label: 'Follow-up Lead', icon: 'UserCheck' },
}
