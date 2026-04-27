// Types para o módulo Objetivos — funis de Compradores e Vendedores
// Usados pela API /api/goals/funnel e pela UI em /dashboard/objetivos

export type FunnelType = 'buyer' | 'seller'
export type FunnelPeriod = 'daily' | 'weekly' | 'monthly' | 'annual'
export type FunnelScope = 'consultant' | 'team'
export type FunnelStageStatus = 'on_track' | 'attention' | 'late' | 'completed' | 'pending'
export type FunnelEventSource = 'system' | 'manual'

export type BuyerStageKey =
  | 'contactos'
  | 'pesquisa'
  | 'visita'
  | 'proposta'
  | 'cpcv'
  | 'escritura'

export type SellerStageKey =
  | 'contactos'
  | 'pre_angariacao'
  | 'estudo_mercado'
  | 'angariacao'
  | 'visita'
  | 'proposta'
  | 'cpcv'
  | 'escritura'

export type FunnelStageKey = BuyerStageKey | SellerStageKey

export interface FunnelStageDef {
  key: FunnelStageKey
  funnel: FunnelType
  order: number
  label: string
  /** Short 3-5 char label for compact UIs (mini-funnels in cards). */
  shortLabel: string
  /** Conversion rate from THIS stage to the NEXT (0-1). Used to cascade targets backwards. */
  defaultConversionRate: number
  /** Empty-state contextual hint when realized=0. */
  emptyHint: string
}

export interface FunnelStageResult {
  key: FunnelStageKey
  label: string
  order: number
  realized: number
  target: number
  percent: number
  status: FunnelStageStatus
  /** Right-aligned contextual message ("Faltam 13 contactos esta semana") */
  message: string
  source_breakdown: { system: number; manual: number }
  is_terminal_completed: boolean
}

export interface FunnelSummary {
  conv_total_pct: number
  realized_eur: number
  avg_cycle_days: number | null
}

export interface FunnelData {
  funnel: FunnelType
  status: FunnelStageStatus
  stages: FunnelStageResult[]
  summary: FunnelSummary
}

export interface FunnelResponse {
  scope: FunnelScope
  consultant: {
    id: string
    commercial_name: string
    profile_photo_url: string | null
  }
  /** When scope='team', list of consultor ids included in the aggregate. */
  team_member_count?: number
  period: FunnelPeriod
  period_start: string // YYYY-MM-DD
  period_end: string // YYYY-MM-DD
  period_target_eur: number
  buyer: FunnelData
  seller: FunnelData
}

export interface FunnelManualEventInput {
  consultant_id: string
  funnel_type: FunnelType
  stage_key: FunnelStageKey
  occurred_at: string // ISO datetime
  notes?: string
  ref_lead_id?: string
  ref_negocio_id?: string
  ref_property_id?: string
}

// ── Team overview (manager grid view) ────────────────────────────────────

export interface TeamOverviewStageDot {
  key: string
  short_label: string
  status: FunnelStageStatus
  realized: number
  target: number
}

export interface TeamOverviewConsultantCard {
  consultant_id: string
  commercial_name: string
  profile_photo_url: string | null
  /** Composite status (worst-of revenue OR funnel achievement, both capped at 100%). */
  status: FunnelStageStatus
  /** Composite achievement % (max of revenue_pct and funnel_avg_pct, capped at 100). */
  composite_pct: number
  /** Revenue achievement % (uncapped — can exceed 100). */
  revenue_pct: number
  /** Average % across all stages of both funnels (capped at 100 per stage). */
  funnel_avg_pct: number
  buyer_pct: number
  seller_pct: number
  buyer_status: FunnelStageStatus
  seller_status: FunnelStageStatus
  period_target_eur: number
  realized_eur: number
  /** Most behind stage label (e.g. "Contactos") for the worst funnel. */
  bottleneck_label: string | null
  bottleneck_message: string | null
  /** Stage-by-stage status + counts, used to render the mini-funnel on each card. */
  buyer_stage_dots: TeamOverviewStageDot[]
  seller_stage_dots: TeamOverviewStageDot[]
}

export interface TeamOverviewKpis {
  total_realized_eur: number
  total_target_eur: number
  achievement_pct: number
  count_late: number
  count_attention: number
  count_on_track: number
}

export interface TeamOverviewResponse {
  period: FunnelPeriod
  period_start: string
  period_end: string
  team_period_target_eur: number
  kpis: TeamOverviewKpis
  consultants: TeamOverviewConsultantCard[]
}
