import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Link Idealista" (`834d55ca-...`) — campo
 * `link_external` para o URL do imóvel no portal Idealista.
 */
export const fieldPropertyLinkIdealistaRule: SubtaskRule = {
  key: 'field_property_link_idealista',
  description: 'Link do imóvel no portal Idealista.',
  taskKind: 'Publicar a angariação nos portais',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '834d55ca-7ccc-4a18-b4a0-6c23351006c9',

  titleBuilder: () => 'Link portal Idealista',

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Link Portal Idealista',
      field_name: 'link_portal_idealista',
      field_type: 'link_external',
      order_index: 0,
      placeholder: 'https://www.idealista.pt/...',
      target_entity: 'property',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
