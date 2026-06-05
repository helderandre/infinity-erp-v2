import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Estado de Publicação" (`5e35b207-...`) —
 * select com options de `PROPERTY_STATUS` em `dev_properties.business_status`.
 */
export const fieldPropertyBusinessStatusRule: SubtaskRule = {
  key: 'field_property_business_status',
  description:
    'Select do estado de publicação do imóvel (constante `PROPERTY_STATUS`).',
  taskKind: 'Registar o ID do imóvel, a data de entrada e observações',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '5e35b207-4007-4bf4-b32a-d34626459f66',

  titleBuilder: () => 'Estado de publicação',

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Estado de Publicação',
      field_name: 'business_status',
      field_type: 'select',
      order_index: 0,
      target_entity: 'property',
      options_from_constant: 'PROPERTY_STATUS',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
