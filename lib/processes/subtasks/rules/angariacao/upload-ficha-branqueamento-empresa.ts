import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Pessoa Colectiva: Ficha de Branqueamento (Empresa).
 * 1 linha por owner coletivo.
 */
export const uploadFichaBranqueamentoEmpresaRule: SubtaskRule = {
  key: 'upload_ficha_branqueamento_empresa',
  description: 'Upload da Ficha de Branqueamento de Capitais da empresa.',
  taskKind: 'Documentos Pessoa Colectiva',
  ownerScope: 'all',
  personTypeFilter: 'coletiva',
  isMandatory: true,

  supersedesTplSubtaskId: '7d7cc165-5a59-486f-8d07-5bfc042407d1',

  titleBuilder: (ctx) => {
    const name = ctx.owner?.name?.trim() || 'empresa'
    return `Ficha de Branqueamento — ${name}`
  },

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: 'f9a3ee8f-04a6-40f0-aae0-021ae7c48c6d',
  }),

  Component: null,
  complete: async () => ({}),
}
