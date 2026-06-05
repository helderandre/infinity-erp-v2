// Registry of taxonomy scopes that accept user-contributed extras.
//
// Each scope binds a string key (used by `<SelectWithOther scope>` and stored
// in `taxonomy_extras.scope`) to:
//   - hardcodedKeys: canonical set of values from lib/constants.ts. Used by
//     the API to prevent extras from colliding with system values.
//   - valueFormat: 'slug' (lowercased ascii — converted via slugifyTaxonomyValue)
//     or 'label' (stored verbatim, mirrors what the form column already saves).
//   - label: PT-PT label for the admin screen.
//
// Add a new scope here when you wire `<SelectWithOther>` into a new field —
// no schema changes needed.

import { PROPERTY_TYPES, TYPOLOGIES } from '@/lib/constants'

export type TaxonomyScope = 'property_type' | 'typology'

interface ScopeDefinition {
  label: string
  hardcodedKeys: ReadonlyArray<string>
  valueFormat: 'slug' | 'label'
}

export const TAXONOMY_SCOPES: Record<TaxonomyScope, ScopeDefinition> = {
  // Tipos de Imóvel — partilhado entre o form de Imóveis (Nova Angariação /
  // Edit Sheet) e os forms de CRM/Negócios/Contactos. Ambas as colunas
  // (`dev_properties.property_type` + `negocios.tipo_imovel`) passaram a
  // guardar labels após a migração `unify_property_type_taxonomy`.
  property_type: {
    label: 'Tipos de Imóvel',
    hardcodedKeys: Object.keys(PROPERTY_TYPES),
    valueFormat: 'label',
  },
  // Tipologias — partilhado entre todos os formulários de imóvel/negócio.
  // Coluna `dev_property_specifications.typology` guarda labels (T0..T6 + extras
  // como 'T6+', 'Loft' criadas via "Outro…").
  typology: {
    label: 'Tipologias',
    hardcodedKeys: TYPOLOGIES,
    valueFormat: 'label',
  },
}

export function isValidScope(scope: string): scope is TaxonomyScope {
  return scope in TAXONOMY_SCOPES
}

export function isHardcodedValue(scope: TaxonomyScope, value: string): boolean {
  return TAXONOMY_SCOPES[scope].hardcodedKeys.includes(value)
}

export function getScope(scope: TaxonomyScope): ScopeDefinition {
  return TAXONOMY_SCOPES[scope]
}
