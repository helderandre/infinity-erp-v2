// Maps the nine legacy `marketing_kit_templates.category` values (CHECK
// constraint) onto the dynamic `marketing_design_categories.slug` values so
// the fixed Kit catalogue can be rendered grouped by the same taxonomy as
// Team Designs and Personal Designs.
//
// The kit catalogue is institutional (admin-curated) and intentionally keeps
// its own CHECK constraint — we only need a visual alignment.
//
// If a design category is deactivated by an admin, resolution falls back to
// `outro`, which is `is_system=true` and always active.

export type KitCategorySlug =
  | 'cartao_visita'
  | 'cartao_digital'
  | 'badge'
  | 'placa_venda'
  | 'placa_arrendamento'
  | 'assinatura_email'
  | 'relatorio_imovel'
  | 'estudo_mercado'
  | 'outro'

export type DesignCategorySlug =
  | 'placas'
  | 'cartoes'
  | 'badges'
  | 'assinaturas'
  | 'relatorios'
  | 'estudos'
  | 'redes_sociais'
  | 'outro'

export const KIT_CATEGORY_TO_DESIGN_SLUG: Record<KitCategorySlug, DesignCategorySlug> = {
  cartao_visita:      'cartoes',
  cartao_digital:     'cartoes',
  badge:              'badges',
  placa_venda:        'placas',
  placa_arrendamento: 'placas',
  assinatura_email:   'assinaturas',
  relatorio_imovel:   'relatorios',
  estudo_mercado:     'estudos',
  outro:              'outro',
}

export function resolveKitDesignSlug(
  kitCategory: string,
  activeDesignSlugs: ReadonlySet<string>
): DesignCategorySlug {
  const mapped = KIT_CATEGORY_TO_DESIGN_SLUG[kitCategory as KitCategorySlug]
  if (mapped && activeDesignSlugs.has(mapped)) return mapped
  return 'outro'
}
