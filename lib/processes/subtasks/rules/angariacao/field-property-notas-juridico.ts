import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Notas Jurídico Convictus" (`08c530c9-...`) —
 * campo `rich_text` em `dev_properties.notas_juridico_convictus`.
 */
export const fieldPropertyNotasJuridicoRule: SubtaskRule = {
  key: 'field_property_notas_juridico',
  description: 'Notas jurídicas do processual ConviCtus sobre o imóvel.',
  taskKind: 'Registar o ID do imóvel, a data de entrada e observações',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '08c530c9-544c-4698-87f3-3a616d8c94f5',

  titleBuilder: () => 'Notas Jurídico ConviCtus',

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Notas Jurídico Convictus',
      field_name: 'notas_juridico_convictus',
      field_type: 'rich_text',
      order_index: 0,
      target_entity: 'property',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
