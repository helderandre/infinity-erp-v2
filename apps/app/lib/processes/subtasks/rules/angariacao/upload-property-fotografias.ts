import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Fotografias do Imóvel" (`ede2d1df-...`) —
 * form de 1 secção com field `media_upload` que integra o
 * `PropertyMediaUpload` existente (crop + compressão WebP + reorder).
 *
 * Estruturado como `type: 'form'` (não `type: 'upload'`) porque o
 * legacy modela assim — `media_upload` é um `field_type` especial
 * dentro do form schema.
 */
export const uploadPropertyFotografiasRule: SubtaskRule = {
  key: 'upload_property_fotografias',
  description:
    'Upload das fotografias do imóvel via `PropertyMediaUpload` (crop + WebP + reorder).',
  taskKind: 'Upload das imagens do Imóvel',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: 'ede2d1df-d705-4ab3-b61c-3ab27291fbff',

  titleBuilder: () => 'Fotografias do imóvel',

  configBuilder: () => ({
    type: 'form',
    sections: [
      {
        title: 'Fotografias do Imóvel',
        description: '',
        order_index: 0,
        fields: [
          {
            label: 'Fotografias do Imóvel',
            field_name: 'media',
            field_type: 'media_upload',
            order_index: 0,
            target_entity: 'property',
          },
        ],
      },
    ],
  }),

  Component: null,
  complete: async () => ({}),
}
