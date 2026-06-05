import type {
  FunnelType,
  FunnelPeriod,
  FunnelStageKey,
  FunnelStageResult,
  FunnelStageStatus,
} from '@/types/funnel'
import { getStagesFor } from './stages'

export interface ComputeStageTargetsArgs {
  funnel: FunnelType
  /** € target for the period (NOT annual). */
  periodEuroTarget: number
  /** Average value of a closed deal on this funnel. */
  avgDealValue: number
  /** Commission % on a closed deal (0-100). */
  commissionPct: number
  /** Map of conversion rate overrides per stage (0-1). */
  conversionOverrides?: Partial<Record<FunnelStageKey, number>>
  /** Map of absolute target overrides per stage (already scaled to the period). */
  absoluteOverrides?: Partial<Record<FunnelStageKey, number>>
}

/**
 * Factor da parte do consultor numa comissão de deal típico. O `commission_pct`
 * registado no goal é a comissão da agência (ex.: 5%); o consultor recebe
 * tipicamente metade dessa comissão por representar uma das duas pontas
 * (compra OU venda) — a outra metade vai para o agente do outro lado ou para
 * a agência. Quando o consultor representa ambos os lados (`pleno_agencia`)
 * recebe os 100%, mas isso é a excepção e não pode ser previsto à frente
 * num target anual.
 */
const CONSULTANT_SIDE_FACTOR = 0.5

/**
 * Cascades the period € target backwards through the funnel using the
 * conversion-rate chain. Each stage's target is computed as the next
 * stage's target divided by the conversion rate from this stage to the next.
 *
 *   target[escritura] = € / (avg_deal_value * commission_pct/100 * 0.5)
 *   target[cpcv]      = target[escritura] / cr(cpcv→escritura)
 *   target[proposta]  = target[cpcv]      / cr(proposta→cpcv)
 *   ...
 *
 * O factor `0.5` reflecte que o consultor só recebe a parte da comissão que
 * lhe corresponde do negócio (uma das duas pontas). Sem este factor o sistema
 * sobre-estima o ganho por deal e o número-alvo de escrituras vem subdimensionado.
 *
 * Absolute overrides win over the cascade — they're values the gestor pinned.
 */
export function computeStageTargets(args: ComputeStageTargetsArgs): Record<FunnelStageKey, number> {
  const stages = getStagesFor(args.funnel)
  const result: Partial<Record<FunnelStageKey, number>> = {}

  // Final stage = € / (consultor's take per deal)
  const commissionPerDeal =
    args.avgDealValue > 0 && args.commissionPct > 0
      ? args.avgDealValue * (args.commissionPct / 100) * CONSULTANT_SIDE_FACTOR
      : 0
  const closesTarget = commissionPerDeal > 0 ? args.periodEuroTarget / commissionPerDeal : 0

  // Walk backwards from the last stage
  let nextTarget = closesTarget
  for (let i = stages.length - 1; i >= 0; i--) {
    const stage = stages[i]

    // Absolute override wins
    const absOverride = args.absoluteOverrides?.[stage.key]
    if (absOverride !== undefined) {
      result[stage.key] = absOverride
      nextTarget = absOverride
      continue
    }

    if (i === stages.length - 1) {
      // Last stage = closes
      result[stage.key] = closesTarget
      nextTarget = closesTarget
      continue
    }

    const cr = args.conversionOverrides?.[stage.key] ?? stage.defaultConversionRate
    const target = cr > 0 ? nextTarget / cr : 0
    result[stage.key] = target
    nextTarget = target
  }

  return result as Record<FunnelStageKey, number>
}

/**
 * Input ratio per stage = 1 / conversion_rate(prev → this).
 *
 * Frames the funnel as the consultor sees it day-to-day:
 *   "Para 1 proposta: 5 visitas"   (ratio_from_prev=5 on stage 'proposta')
 *   "Para 1 CPCV: 2.2 propostas"   (ratio_from_prev=2.22 on stage 'cpcv')
 *
 * The first stage has no input → null. Conversion overrides are applied
 * to the PREVIOUS stage's rate (since cr lives on the source-side stage).
 */
export interface StageInputRatio {
  ratio_from_prev: number | null
  prev_label: string | null
  prev_key: FunnelStageKey | null
}

export function computeInputRatios(
  funnel: FunnelType,
  conversionOverrides?: Partial<Record<FunnelStageKey, number>>,
): Record<FunnelStageKey, StageInputRatio> {
  const stages = getStagesFor(funnel)
  const out: Partial<Record<FunnelStageKey, StageInputRatio>> = {}
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    if (i === 0) {
      out[stage.key] = { ratio_from_prev: null, prev_label: null, prev_key: null }
      continue
    }
    const prev = stages[i - 1]
    const cr = conversionOverrides?.[prev.key] ?? prev.defaultConversionRate
    const ratio = cr > 0 ? 1 / cr : null
    out[stage.key] = {
      ratio_from_prev: ratio !== null ? Math.round(ratio * 10) / 10 : null,
      prev_label: prev.label,
      prev_key: prev.key,
    }
  }
  return out as Record<FunnelStageKey, StageInputRatio>
}

/**
 * How many MORE inputs of the previous stage are needed right now so that
 * the next event of `thisKey` can be produced. Returns 0 when the consultor
 * already has enough "carry" to land the next one.
 */
export function inputsNeededForNextOne(args: {
  ratio: number | null
  realizedThis: number
  realizedPrev: number
}): number | null {
  if (args.ratio === null || args.ratio <= 0) return null
  const targetCarry = (args.realizedThis + 1) * args.ratio
  return Math.max(0, Math.ceil(targetCarry - args.realizedPrev))
}

export function statusFromPercent(percent: number): FunnelStageStatus {
  if (percent >= 100) return 'completed'
  if (percent >= 90) return 'on_track'
  if (percent >= 50) return 'attention'
  return 'late'
}

/**
 * Computes the contextual right-aligned message for a stage.
 *
 * Examples produced:
 *   "Faltam 13 contactos esta semana"
 *   "Em linha"
 *   "Concluído"
 *   "Sem visitas no período"
 */
export function buildStageMessage(args: {
  realized: number
  target: number
  status: FunnelStageStatus
  stageLabel: string
  period: FunnelPeriod
  emptyHint: string
}): string {
  const { realized, target, status, stageLabel, period, emptyHint } = args

  if (realized === 0 && target === 0) return emptyHint
  if (status === 'completed') return realized > target ? `Acima do objetivo (${realized})` : 'Concluído'
  if (status === 'on_track') return 'Em linha'

  const remaining = Math.max(0, Math.ceil(target - realized))
  if (remaining === 0) return 'Em linha'

  const periodLabel = {
    daily: 'hoje',
    weekly: 'esta semana',
    monthly: 'este mês',
    annual: 'este ano',
  }[period]

  const noun = stageLabel.toLowerCase()
  return `Faltam ${remaining} ${noun} ${periodLabel}`
}

/**
 * Computes the overall status of a funnel from its stage statuses.
 *
 *   late   if ANY stage is `late`
 *   attention   if ANY stage is `attention`
 *   on_track    otherwise
 */
export function aggregateFunnelStatus(stages: FunnelStageResult[]): FunnelStageStatus {
  if (stages.some((s) => s.status === 'late')) return 'late'
  if (stages.some((s) => s.status === 'attention')) return 'attention'
  if (stages.every((s) => s.status === 'completed' || s.status === 'on_track')) return 'on_track'
  return 'on_track'
}

/**
 * Total conversion rate of the funnel = realized[last] / realized[first] * 100.
 */
export function computeTotalConversion(stages: FunnelStageResult[]): number {
  if (stages.length < 2) return 0
  const first = stages[0].realized
  const last = stages[stages.length - 1].realized
  if (first <= 0) return 0
  return Math.round((last / first) * 1000) / 10
}
