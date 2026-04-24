import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Registar Draft" (`4cb1326f-...`) — campo
 * `remax_draft_number` em `dev_properties`.
 */
export const fieldPropertyRemaxDraftNumberRule: SubtaskRule = {
  key: 'field_property_remax_draft_number',
  description: 'Registar o número de Draft RE/MAX em `dev_properties.remax_draft_number`.',
  taskKind: 'Draft do Imóvel',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '4cb1326f-6a3f-4926-a80c-e125a9c586da',

  titleBuilder: () => 'Número Draft RE/MAX',

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Número Draft RE/MAX',
      field_name: 'remax_draft_number',
      field_type: 'text',
      order_index: 0,
      target_entity: 'property',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
