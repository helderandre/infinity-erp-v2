import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Pessoa Singular: Ficha de Branqueamento de
 * Capitais (FBC) de cada owner singular.
 *
 * IMPORTANTE: segundo a UI, é "uma por proprietário, mesmo em caso de
 * casados" — o `ownerScope: 'all'` com `personTypeFilter: 'singular'`
 * garante isto (um owner, um FBC; casais têm 2 owners = 2 FBC).
 */
export const uploadFichaBranqueamentoCapitaisSingularRule: SubtaskRule = {
  key: 'upload_ficha_branqueamento_capitais_singular',
  description: 'Upload da Ficha de Branqueamento de Capitais de cada owner singular.',
  taskKind: 'Documentos Pessoa Singular',
  ownerScope: 'all',
  personTypeFilter: 'singular',
  isMandatory: true,
  hint: 'Uma por proprietário, mesmo em caso de casados',

  supersedesTplSubtaskId: '499302c0-954a-4d5e-91c6-ae464768e98c',

  titleBuilder: (ctx) => {
    const first = ctx.owner?.name?.trim().split(/\s+/)[0] || 'proprietário'
    return `Ficha de Branqueamento — ${first}`
  },

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: '02b63b46-d5ed-4314-9e83-1447095f8a15',
  }),

  Component: null,
  complete: async () => ({}),
}
