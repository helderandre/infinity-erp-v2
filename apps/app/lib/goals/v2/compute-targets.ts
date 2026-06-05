import { CPCV_TO_ESCRITURA_RATE, DEAL_SIDE_SHARE, type AgentGoalInput, type ComputedTargets } from '@/types/agent-goal'

// Pure function. Given the goal input, returns derived annual + weekly targets.
// Used both in the live projection panel (client) and after upsert (server).
export function computeAgentGoalTargets(g: AgentGoalInput): ComputedTargets {
  const vendRevenueTarget = g.annual_revenue_target_eur * (g.pct_vendedores / 100)
  const compRevenueTarget = g.annual_revenue_target_eur * (g.pct_compradores / 100)

  // Each deal splits the agency commission between listing side and buyer side.
  // E.g. 5% of €250k = €12,500 total → €6,250 to the vendedor side, €6,250 to the
  // comprador side. An agent doing both sides records two entries (one per chain).
  const vendCommissionPerDeal = g.vendedor_avg_sale_value_eur * (g.vendedor_commission_pct / 100) * DEAL_SIDE_SHARE
  const compCommissionPerDeal = g.comp_avg_purchase_value_eur * (g.comp_commission_pct / 100) * DEAL_SIDE_SHARE

  const vendEscrituras = vendCommissionPerDeal > 0 ? vendRevenueTarget / vendCommissionPerDeal : 0
  const compEscrituras = compCommissionPerDeal > 0 ? compRevenueTarget / compCommissionPerDeal : 0

  // Vendedor backward chain (Escritura → Contactos)
  const vendCpcvs = vendEscrituras / CPCV_TO_ESCRITURA_RATE
  const vendPropostas = vendCpcvs * g.vend_propostas_per_cpcv
  const vendVisitas = vendPropostas * g.vend_visitas_per_proposta
  const vendAngariacoes = vendEscrituras * g.vend_angariacoes_per_escritura
  const vendEstudos = vendAngariacoes * g.vend_estudos_per_angariacao
  const vendPreAngariacoes = vendEstudos * g.vend_pre_angariacoes_per_estudo
  const vendContactos = vendPreAngariacoes * g.vend_contactos_per_pre_angariacao

  // Comprador backward chain
  const compCpcvs = compEscrituras / CPCV_TO_ESCRITURA_RATE
  const compPropostas = compCpcvs * g.comp_propostas_per_cpcv
  const compVisitas = compPropostas * g.comp_visitas_per_proposta
  const compPesquisas = compVisitas * g.comp_pesquisas_per_visita
  const compContactos = compPesquisas * g.comp_contactos_per_pesquisa

  const weeks = g.working_weeks_per_year || 1

  const vendProjectedRevenue = vendEscrituras * vendCommissionPerDeal
  const compProjectedRevenue = compEscrituras * compCommissionPerDeal

  return {
    vend_target_escrituras: vendEscrituras,
    vend_target_cpcvs: vendCpcvs,
    vend_target_propostas: vendPropostas,
    vend_target_visitas: vendVisitas,
    vend_target_angariacoes: vendAngariacoes,
    vend_target_estudos: vendEstudos,
    vend_target_pre_angariacoes: vendPreAngariacoes,
    vend_target_contactos: vendContactos,
    vend_projected_revenue_eur: vendProjectedRevenue,

    comp_target_escrituras: compEscrituras,
    comp_target_cpcvs: compCpcvs,
    comp_target_propostas: compPropostas,
    comp_target_visitas: compVisitas,
    comp_target_pesquisas: compPesquisas,
    comp_target_contactos: compContactos,
    comp_projected_revenue_eur: compProjectedRevenue,

    vend_contactos_per_week: vendContactos / weeks,
    vend_visitas_per_week: vendVisitas / weeks,
    comp_contactos_per_week: compContactos / weeks,
    comp_visitas_per_week: compVisitas / weeks,

    total_projected_revenue_eur: vendProjectedRevenue + compProjectedRevenue,
  }
}
