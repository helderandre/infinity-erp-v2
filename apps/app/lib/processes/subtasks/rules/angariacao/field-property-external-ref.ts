import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Registar ID Externo" (`ad40a71c-...`) —
 * campo `external_ref` em `dev_properties` (referência RE/MAX).
 */
export const fieldPropertyExternalRefRule: SubtaskRule = {
  key: 'field_property_external_ref',
  description: 'Referência externa do imóvel (ex.: ID RE/MAX).',
  taskKind: 'Registar o ID do imóvel, a data de entrada e observações',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: 'ad40a71c-1113-4a49-a0a0-5e42292befa5',

  titleBuilder: () => 'Referência externa',

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Referência Externa',
      field_name: 'external_ref',
      field_type: 'text',
      order_index: 0,
      target_entity: 'property',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
