import { z } from 'zod'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const positive = z.number().positive('Deve ser maior que zero')
const ratio = z.number().positive('Deve ser maior que zero')
const pct = z.number().min(0).max(100)

export const agentGoalSchema = z.object({
  agent_id: z.string().regex(uuidRegex, 'ID de consultor inválido'),
  period_year: z.number().int().min(2024).max(2050),
  annual_revenue_target_eur: positive,
  pct_vendedores: pct,
  pct_compradores: pct,
  working_weeks_per_year: z.number().int().min(1).max(52),
  working_days_per_week: z.number().int().min(1).max(7),

  vendedor_avg_sale_value_eur: positive,
  vendedor_commission_pct: pct,

  vend_contactos_per_pre_angariacao: ratio,
  vend_pre_angariacoes_per_estudo: ratio,
  vend_estudos_per_angariacao: ratio,
  vend_angariacoes_per_escritura: ratio,
  vend_visitas_per_proposta: ratio,
  vend_propostas_per_cpcv: ratio,

  comp_avg_purchase_value_eur: positive,
  comp_commission_pct: pct,

  comp_contactos_per_pesquisa: ratio,
  comp_pesquisas_per_visita: ratio,
  comp_visitas_per_proposta: ratio,
  comp_propostas_per_cpcv: ratio,
}).refine(
  (d) => Math.abs((d.pct_vendedores + d.pct_compradores) - 100) < 0.01,
  { message: 'A soma vendedores + compradores deve ser 100%', path: ['pct_vendedores'] }
)

export type AgentGoalInputValidated = z.infer<typeof agentGoalSchema>
