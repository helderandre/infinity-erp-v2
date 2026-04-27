import type { FunnelStageDef, FunnelStageKey, FunnelType } from '@/types/funnel'

// Conversion rates are educated defaults for PT residential real estate.
// Each rate is "from THIS stage to the NEXT" (0-1). The gestor can override
// per-consultor via `temp_consultant_goals.funnel_conversion_rates` (jsonb)
// or per-stage absolute targets via `funnel_target_overrides`.
//
// Rationale per rate:
//   buyer cumulativo  ≈ 2.0%  (≈ 49 contactos por escritura)
//   seller cumulativo ≈ 1.2%  (≈ 86 contactos por escritura)
//
// Anchored against industry consensus for residential PT (1-3% buyer,
// 1-2.5% seller end-to-end). After ~12 months of activity these will be
// replaced by per-consultor learned averages.

export const BUYER_STAGES: FunnelStageDef[] = [
  {
    key: 'contactos',
    funnel: 'buyer',
    order: 1,
    label: 'Contactos',
    shortLabel: 'Cont',
    // ~60% dos leads engajados recebem opções (alguns ficam sem follow-up)
    defaultConversionRate: 0.6,
    emptyHint: 'Sem novos contactos no período',
  },
  {
    key: 'pesquisa',
    funnel: 'buyer',
    order: 2,
    label: 'Pesquisa de imóveis',
    shortLabel: 'Pesq',
    // ~40% dos envios geram visita
    defaultConversionRate: 0.4,
    emptyHint: 'Sem envios de imóveis no período',
  },
  {
    key: 'visita',
    funnel: 'buyer',
    order: 3,
    label: 'Visitas',
    shortLabel: 'Vis',
    // ~20% das visitas convertem em proposta (residencial PT, mistura cold+warm)
    defaultConversionRate: 0.2,
    emptyHint: 'Sem visitas no período',
  },
  {
    key: 'proposta',
    funnel: 'buyer',
    order: 4,
    label: 'Propostas',
    shortLabel: 'Prop',
    // ~45% das propostas chegam a CPCV (metade das negociações parte)
    defaultConversionRate: 0.45,
    emptyHint: 'Sem propostas no período',
  },
  {
    key: 'cpcv',
    funnel: 'buyer',
    order: 5,
    label: 'CPCV',
    shortLabel: 'CPCV',
    // ~95% dos CPCV chegam a escritura (fall-through de financiamento ~5%)
    defaultConversionRate: 0.95,
    emptyHint: 'Sem CPCV no período',
  },
  {
    key: 'escritura',
    funnel: 'buyer',
    order: 6,
    label: 'Escritura',
    shortLabel: 'Esc',
    // Terminal — não cascateia
    defaultConversionRate: 1.0,
    emptyHint: 'Sem escrituras no período',
  },
]

export const SELLER_STAGES: FunnelStageDef[] = [
  {
    key: 'contactos',
    funnel: 'seller',
    order: 1,
    label: 'Contactos',
    shortLabel: 'Cont',
    // ~55% dos contactos de vendedor aceitam reunião de pré-angariação
    defaultConversionRate: 0.55,
    emptyHint: 'Sem novos contactos no período',
  },
  {
    key: 'pre_angariacao',
    funnel: 'seller',
    order: 2,
    label: 'Pré-angariação',
    shortLabel: 'Pré',
    // ~70% das pré-angariações pedem estudo de mercado
    defaultConversionRate: 0.7,
    emptyHint: 'Sem pré-angariações no período',
  },
  {
    key: 'estudo_mercado',
    funnel: 'seller',
    order: 3,
    label: 'Estudo de Mercado',
    shortLabel: 'EM',
    // ~50% dos estudos apresentados resultam em angariação assinada
    defaultConversionRate: 0.5,
    emptyHint: 'Sem estudos de mercado no período',
  },
  {
    key: 'angariacao',
    funnel: 'seller',
    order: 4,
    label: 'Angariação',
    shortLabel: 'Ang',
    // ~85% dos listings activos têm visitas (base anual)
    defaultConversionRate: 0.85,
    emptyHint: 'Sem angariações no período',
  },
  {
    key: 'visita',
    funnel: 'seller',
    order: 5,
    label: 'Visitas',
    shortLabel: 'Vis',
    // ~15% das visitas a um listing geram proposta (lado vendedor é ainda mais selectivo)
    defaultConversionRate: 0.15,
    emptyHint: 'Sem visitas no período',
  },
  {
    key: 'proposta',
    funnel: 'seller',
    order: 6,
    label: 'Propostas',
    shortLabel: 'Prop',
    // ~50% das propostas (vista do vendedor) chegam a CPCV
    defaultConversionRate: 0.5,
    emptyHint: 'Sem propostas no período',
  },
  {
    key: 'cpcv',
    funnel: 'seller',
    order: 7,
    label: 'CPCV',
    shortLabel: 'CPCV',
    // ~95% como no funil comprador
    defaultConversionRate: 0.95,
    emptyHint: 'Sem CPCV no período',
  },
  {
    key: 'escritura',
    funnel: 'seller',
    order: 8,
    label: 'Escritura',
    shortLabel: 'Esc',
    defaultConversionRate: 1.0,
    emptyHint: 'Sem escrituras no período',
  },
]

export function getStagesFor(funnel: FunnelType): FunnelStageDef[] {
  return funnel === 'buyer' ? BUYER_STAGES : SELLER_STAGES
}

export function getStageDef(funnel: FunnelType, key: FunnelStageKey): FunnelStageDef | undefined {
  return getStagesFor(funnel).find((s) => s.key === key)
}
