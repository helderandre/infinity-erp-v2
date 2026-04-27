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
    defaultConversionRate: 0.5, // 50% of new buyer contacts become active searches
    emptyHint: 'Sem novos contactos no período',
  },
  {
    key: 'pesquisa',
    funnel: 'buyer',
    order: 2,
    label: 'Pesquisa de imóveis',
    defaultConversionRate: 0.4, // 40% of clients receiving properties book a visit
    emptyHint: 'Sem envios de imóveis no período',
  },
  {
    key: 'visita',
    funnel: 'buyer',
    order: 3,
    label: 'Visitas',
    defaultConversionRate: 0.3, // 30% of visits lead to a proposal
    emptyHint: 'Sem visitas no período',
  },
  {
    key: 'proposta',
    funnel: 'buyer',
    order: 4,
    label: 'Propostas',
    defaultConversionRate: 0.6, // 60% of proposals lead to a CPCV
    emptyHint: 'Sem propostas no período',
  },
  {
    key: 'cpcv',
    funnel: 'buyer',
    order: 5,
    label: 'CPCV',
    defaultConversionRate: 1.0, // 100% — in PT every CPCV becomes Escritura (eventually)
    emptyHint: 'Sem CPCV no período',
  },
  {
    key: 'escritura',
    funnel: 'buyer',
    order: 6,
    label: 'Escritura',
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
    defaultConversionRate: 0.4, // 40% of seller contacts move to pre-angariação
    emptyHint: 'Sem novos contactos no período',
  },
  {
    key: 'pre_angariacao',
    funnel: 'seller',
    order: 2,
    label: 'Pré-angariação',
    defaultConversionRate: 0.7, // 70% of pre-angariações receive a market study
    emptyHint: 'Sem pré-angariações no período',
  },
  {
    key: 'estudo_mercado',
    funnel: 'seller',
    order: 3,
    label: 'Estudo de Mercado',
    defaultConversionRate: 0.8, // 80% of market studies become listings
    emptyHint: 'Sem estudos de mercado no período',
  },
  {
    key: 'angariacao',
    funnel: 'seller',
    order: 4,
    label: 'Angariação',
    defaultConversionRate: 0.5, // 50% of listings get visited
    emptyHint: 'Sem angariações no período',
  },
  {
    key: 'visita',
    funnel: 'seller',
    order: 5,
    label: 'Visitas',
    defaultConversionRate: 0.25, // 25% of visits result in a proposal
    emptyHint: 'Sem visitas no período',
  },
  {
    key: 'proposta',
    funnel: 'seller',
    order: 6,
    label: 'Propostas',
    defaultConversionRate: 0.7,
    emptyHint: 'Sem propostas no período',
  },
  {
    key: 'cpcv',
    funnel: 'seller',
    order: 7,
    label: 'CPCV',
    defaultConversionRate: 1.0,
    emptyHint: 'Sem CPCV no período',
  },
  {
    key: 'escritura',
    funnel: 'seller',
    order: 8,
    label: 'Escritura',
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
