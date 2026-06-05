import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Escrever a descrição do imóvel"
 * (`b045400a-...`) — campo rich_text gravado em `dev_properties.description`.
 */
export const fieldPropertyDescricaoRule: SubtaskRule = {
  key: 'field_property_descricao',
  description:
    'Campo rich_text da descrição comercial do imóvel (target_entity: property).',
  taskKind: 'Finalizar Dados do Imóvel',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: 'b045400a-b063-4bf7-8485-d9823ed973e2',

  titleBuilder: () => 'Descrição do imóvel',

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Descrição',
      field_name: 'description',
      field_type: 'rich_text',
      order_index: 0,
      target_entity: 'property',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
