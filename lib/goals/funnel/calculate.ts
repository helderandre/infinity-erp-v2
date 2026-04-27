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
 * Cascades the period € target backwards through the funnel using the
 * conversion-rate chain. Each stage's target is computed as the next
 * stage's target divided by the conversion rate from this stage to the next.
 *
 *   target[escritura] = € / (avg_deal_value * commission_pct/100)
 *   target[cpcv]      = target[escritura] / cr(cpcv→escritura)
 *   target[proposta]  = target[cpcv]      / cr(proposta→cpcv)
 *   ...
 *
 * Absolute overrides win over the cascade — they're values the gestor pinned.
 */
export function computeStageTargets(args: ComputeStageTargetsArgs): Record<FunnelStageKey, number> {
  const stages = getStagesFor(args.funnel)
  const result: Partial<Record<FunnelStageKey, number>> = {}

  // Final stage = € / commission per deal
  const commissionPerDeal =
    args.avgDealValue > 0 && args.commissionPct > 0
      ? args.avgDealValue * (args.commissionPct / 100)
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
