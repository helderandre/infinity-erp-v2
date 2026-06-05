import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Pessoa Colectiva: CC/Passaporte do representante
 * legal da empresa. 1 linha por owner coletivo.
 */
export const uploadCcPassaporteRepresentanteLegalRule: SubtaskRule = {
  key: 'upload_cc_passaporte_representante_legal',
  description: 'Upload do CC/Passaporte do representante legal (1 por owner coletivo).',
  taskKind: 'Documentos Pessoa Colectiva',
  ownerScope: 'all',
  personTypeFilter: 'coletiva',
  isMandatory: true,

  supersedesTplSubtaskId: '9eb0e316-a879-40a9-9d70-1acccbd91627',

  titleBuilder: (ctx) => {
    const name = ctx.owner?.name?.trim() || 'empresa'
    return `CC / Passaporte do rep. legal — ${name}`
  },

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: '16706cb5-1a27-413d-ad75-ec6aee1c3674',
  }),

  Component: null,
  complete: async () => ({}),
}
