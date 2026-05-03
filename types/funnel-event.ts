// Realized funnel activity events.

export type FunnelSide = 'vendedor' | 'comprador'

export type FunnelStage =
  | 'contacto'
  | 'pre_angariacao'
  | 'estudo'
  | 'angariacao'
  | 'pesquisa'
  | 'visita'
  | 'proposta'
  | 'cpcv'
  | 'fecho'

export const FUNNEL_STAGES: readonly FunnelStage[] = [
  'contacto', 'pre_angariacao', 'estudo', 'angariacao',
  'pesquisa', 'visita', 'proposta', 'cpcv', 'fecho',
] as const

// Stages that can ONLY be auto-captured (not allowed via manual entry).
// Each has a canonical UI flow that creates the underlying record correctly:
//   - pre_angariacao / pesquisa → negocios INSERT
//   - angariacao                → proc_instances goes active
//   - cpcv                      → deal_payments.is_signed
//   - fecho                     → deals.status='completed'
// Blocking manual entry prevents phantom records and inflated revenue counts.
export const MANUAL_BLOCKED_STAGES: readonly FunnelStage[] = [
  'pre_angariacao',
  'pesquisa',
  'angariacao',
  'cpcv',
  'fecho',
] as const

export function isManualAllowed(stage: FunnelStage): boolean {
  return !MANUAL_BLOCKED_STAGES.includes(stage)
}

export interface AgentFunnelEvent {
  id: string
  agent_id: string
  side: FunnelSide
  stage: FunnelStage
  occurred_at: string
  count: number
  source: string
  source_ref_type: string | null
  source_ref_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface StageCounts {
  /** Total events in window (manual + auto) */
  total: number
  /** Subset that were manually logged (source='manual') */
  manual: number
}

export interface FunnelAggregates {
  /** counts[side][stage] = { total, manual } in window */
  counts: Record<FunnelSide, Partial<Record<FunnelStage, StageCounts>>>
  window_start: string
  window_end: string
}
