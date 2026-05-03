// Types para o modelo v2 de objectivos (backward-chained funnel ratios)
// Coexiste com types/goal.ts (legacy temp_consultant_goals).

export interface AgentGoal {
  id: string
  agent_id: string
  period_year: number
  annual_revenue_target_eur: number
  pct_vendedores: number
  pct_compradores: number
  working_weeks_per_year: number
  working_days_per_week: number

  // Vendedor economics
  vendedor_avg_sale_value_eur: number
  vendedor_commission_pct: number

  // Vendedor Card A — Captação
  vend_contactos_per_pre_angariacao: number
  vend_pre_angariacoes_per_estudo: number
  vend_estudos_per_angariacao: number

  // Vendedor Card B — Angariação ao Fecho
  vend_angariacoes_per_escritura: number
  vend_visitas_per_proposta: number
  vend_propostas_per_cpcv: number

  // Comprador economics
  comp_avg_purchase_value_eur: number
  comp_commission_pct: number

  // Comprador funnel
  comp_contactos_per_pesquisa: number
  comp_pesquisas_per_visita: number
  comp_visitas_per_proposta: number
  comp_propostas_per_cpcv: number

  created_at: string
  updated_at: string
}

export interface AgentGoalTargets {
  id: string
  agent_goal_id: string

  vend_target_escrituras: number
  vend_target_cpcvs: number
  vend_target_propostas: number
  vend_target_visitas: number
  vend_target_angariacoes: number
  vend_target_estudos: number
  vend_target_pre_angariacoes: number
  vend_target_contactos: number
  vend_projected_revenue_eur: number

  comp_target_escrituras: number
  comp_target_cpcvs: number
  comp_target_propostas: number
  comp_target_visitas: number
  comp_target_pesquisas: number
  comp_target_contactos: number
  comp_projected_revenue_eur: number

  vend_contactos_per_week: number
  vend_visitas_per_week: number
  comp_contactos_per_week: number
  comp_visitas_per_week: number

  total_projected_revenue_eur: number
  computed_at: string
}

export interface AgentGoalWithTargets extends AgentGoal {
  targets: AgentGoalTargets | null
}

// Input shape for the form / API. All fields required (defaults applied client-side).
export type AgentGoalInput = Omit<AgentGoal, 'id' | 'created_at' | 'updated_at'>

// Computed targets without the persisted columns (id, agent_goal_id, computed_at)
export type ComputedTargets = Omit<AgentGoalTargets, 'id' | 'agent_goal_id' | 'computed_at'>

// CPCVs are treated 1:1 with escrituras for goal-setting. If a CPCV falls
// through (financing rejected, legal issue), the agent simply plans for one
// extra deal — no implicit % loss baked into the math.
export const CPCV_TO_ESCRITURA_RATE = 1.0

// The share of the agency commission attributed to ONE side of a deal
// (listing side vs buyer side). A single agent representing both sides
// counts twice — once in the vendedor side, once in the comprador side.
export const DEAL_SIDE_SHARE = 0.5

export const AGENT_GOAL_DEFAULTS: Omit<AgentGoalInput, 'agent_id' | 'period_year' | 'annual_revenue_target_eur' | 'pct_vendedores' | 'pct_compradores'> = {
  working_weeks_per_year: 48,
  working_days_per_week: 5,

  vendedor_avg_sale_value_eur: 250_000,
  vendedor_commission_pct: 5,
  vend_contactos_per_pre_angariacao: 10,
  vend_pre_angariacoes_per_estudo: 1.25,
  vend_estudos_per_angariacao: 4,
  vend_angariacoes_per_escritura: 1.4,
  vend_visitas_per_proposta: 3.3,
  vend_propostas_per_cpcv: 2,

  comp_avg_purchase_value_eur: 300_000,
  comp_commission_pct: 5,
  comp_contactos_per_pesquisa: 5,
  comp_pesquisas_per_visita: 3.3,
  comp_visitas_per_proposta: 10,
  comp_propostas_per_cpcv: 5,
}
