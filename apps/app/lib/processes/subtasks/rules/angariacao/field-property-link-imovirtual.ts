import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Link Imovirtual" (`5ec595e8-...`) — campo
 * `link_external` para o URL do imóvel no portal Imovirtual.
 */
export const fieldPropertyLinkImovirtualRule: SubtaskRule = {
  key: 'field_property_link_imovirtual',
  description: 'Link do imóvel no portal Imovirtual.',
  taskKind: 'Publicar a angariação nos portais',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '5ec595e8-afea-4430-8237-71900e0d74b0',

  titleBuilder: () => 'Link portal Imovirtual',

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Link Portal Imovirtual',
      field_name: 'link_portal_imovirtual',
      field_type: 'link_external',
      order_index: 0,
      placeholder: 'https://www.imovirtual.com/...',
      target_entity: 'property',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
