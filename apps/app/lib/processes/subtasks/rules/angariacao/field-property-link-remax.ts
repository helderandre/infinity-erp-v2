import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Link portal Cliente Remax" (`fb0588ad-...`) —
 * campo `link_external` (array `listing_links`) para o URL no portal RE/MAX.
 */
export const fieldPropertyLinkRemaxRule: SubtaskRule = {
  key: 'field_property_link_remax',
  description: 'Link do imóvel no portal do cliente RE/MAX.',
  taskKind: 'Registar o ID do imóvel, a data de entrada e observações',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: 'fb0588ad-fa06-4b65-9f2b-1ba44542c920',

  titleBuilder: () => 'Link portal RE/MAX',

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Link Portal RE/MAX',
      field_name: 'link_portal_remax',
      field_type: 'link_external',
      order_index: 0,
      placeholder: 'https://www.remax.pt/...',
      target_entity: 'property',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
