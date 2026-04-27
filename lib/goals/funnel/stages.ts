import type { FunnelStageDef, FunnelStageKey, FunnelType } from '@/types/funnel'

// Conversion rates are educated defaults for PT real estate. The gestor can
// override any individual stage target via `funnel_target_overrides`. After
// ~12 months of accumulated history, these defaults will be replaced by
// per-consultant computed averages.

export const BUYER_STAGES: FunnelStageDef[] = [
  {
    key: 'contactos',
    funnel: 'buyer',
    order: 1,
    label: 'Contactos',
    shortLabel: 'Cont',
    defaultConversionRate: 0.5,
    emptyHint: 'Sem novos contactos no período',
  },
  {
    key: 'pesquisa',
    funnel: 'buyer',
    order: 2,
    label: 'Pesquisa de imóveis',
    shortLabel: 'Pesq',
    defaultConversionRate: 0.4,
    emptyHint: 'Sem envios de imóveis no período',
  },
  {
    key: 'visita',
    funnel: 'buyer',
    order: 3,
    label: 'Visitas',
    shortLabel: 'Vis',
    defaultConversionRate: 0.3,
    emptyHint: 'Sem visitas no período',
  },
  {
    key: 'proposta',
    funnel: 'buyer',
    order: 4,
    label: 'Propostas',
    shortLabel: 'Prop',
    defaultConversionRate: 0.6,
    emptyHint: 'Sem propostas no período',
  },
  {
    key: 'cpcv',
    funnel: 'buyer',
    order: 5,
    label: 'CPCV',
    shortLabel: 'CPCV',
    defaultConversionRate: 1.0,
    emptyHint: 'Sem CPCV no período',
  },
  {
    key: 'escritura',
    funnel: 'buyer',
    order: 6,
    label: 'Escritura',
    shortLabel: 'Esc',
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
    defaultConversionRate: 0.4,
    emptyHint: 'Sem novos contactos no período',
  },
  {
    key: 'pre_angariacao',
    funnel: 'seller',
    order: 2,
    label: 'Pré-angariação',
    shortLabel: 'Pré',
    defaultConversionRate: 0.7,
    emptyHint: 'Sem pré-angariações no período',
  },
  {
    key: 'estudo_mercado',
    funnel: 'seller',
    order: 3,
    label: 'Estudo de Mercado',
    shortLabel: 'EM',
    defaultConversionRate: 0.8,
    emptyHint: 'Sem estudos de mercado no período',
  },
  {
    key: 'angariacao',
    funnel: 'seller',
    order: 4,
    label: 'Angariação',
    shortLabel: 'Ang',
    defaultConversionRate: 0.5,
    emptyHint: 'Sem angariações no período',
  },
  {
    key: 'visita',
    funnel: 'seller',
    order: 5,
    label: 'Visitas',
    shortLabel: 'Vis',
    defaultConversionRate: 0.25,
    emptyHint: 'Sem visitas no período',
  },
  {
    key: 'proposta',
    funnel: 'seller',
    order: 6,
    label: 'Propostas',
    shortLabel: 'Prop',
    defaultConversionRate: 0.7,
    emptyHint: 'Sem propostas no período',
  },
  {
    key: 'cpcv',
    funnel: 'seller',
    order: 7,
    label: 'CPCV',
    shortLabel: 'CPCV',
    defaultConversionRate: 1.0,
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
