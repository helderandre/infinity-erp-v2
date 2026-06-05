import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Data de publicação Remax" (`46f3be15-...`) —
 * campo `date` em `dev_properties.remax_published_date`.
 */
export const fieldPropertyRemaxPublishedDateRule: SubtaskRule = {
  key: 'field_property_remax_published_date',
  description: 'Data efectiva de publicação do imóvel no portal RE/MAX.',
  taskKind: 'Registar o ID do imóvel, a data de entrada e observações',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '46f3be15-6939-4692-823c-52296e1bfb83',

  titleBuilder: () => 'Data de publicação RE/MAX',

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Data de Publicação RE/MAX',
      field_name: 'remax_published_date',
      field_type: 'date',
      order_index: 0,
      target_entity: 'property',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
