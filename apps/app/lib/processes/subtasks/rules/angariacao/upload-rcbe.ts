import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Pessoa Colectiva: RCBE (Registo Central do
 * Beneficiário Efectivo). 1 linha por owner coletivo.
 */
export const uploadRcbeRule: SubtaskRule = {
  key: 'upload_rcbe',
  description: 'Upload do RCBE (Registo Central do Beneficiário Efectivo) da empresa.',
  taskKind: 'Documentos Pessoa Colectiva',
  ownerScope: 'all',
  personTypeFilter: 'coletiva',
  isMandatory: true,
  hint: 'Código de acesso válido',

  supersedesTplSubtaskId: '16829ae3-a482-4c12-bed1-ecd0028ac691',

  titleBuilder: (ctx) => {
    const name = ctx.owner?.name?.trim() || 'empresa'
    return `RCBE — ${name}`
  },

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: '6dd8bf4c-d354-4e0e-8098-eda5a8767fd1',
  }),

  Component: null,
  complete: async () => ({}),
}
