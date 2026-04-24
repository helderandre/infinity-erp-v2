import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Pessoa Singular: CC/Passaporte de cada
 * proprietário pessoa singular.
 */
export const uploadCcPassaporteSingularRule: SubtaskRule = {
  key: 'upload_cc_passaporte_singular',
  description: 'Upload do Cartão de Cidadão ou Passaporte de cada owner singular.',
  taskKind: 'Documentos Pessoa Singular',
  ownerScope: 'all',
  personTypeFilter: 'singular',
  isMandatory: true,

  supersedesTplSubtaskId: '003031a9-dece-47c4-af4d-662329c74adc',

  titleBuilder: (ctx) => {
    const first = ctx.owner?.name?.trim().split(/\s+/)[0] || 'proprietário'
    return `CC / Passaporte — ${first}`
  },

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: '16706cb5-1a27-413d-ad75-ec6aee1c3674',
  }),

  Component: null,
  complete: async () => ({}),
}
