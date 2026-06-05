import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Pessoa Colectiva: campo naturalidade do
 * representante legal. Escreve em `owners.legal_rep_naturality`.
 */
export const fieldNaturalidadeRepresentanteLegalRule: SubtaskRule = {
  key: 'field_naturalidade_representante_legal',
  description: 'Naturalidade do representante legal da empresa.',
  taskKind: 'Documentos Pessoa Colectiva',
  ownerScope: 'all',
  personTypeFilter: 'coletiva',
  isMandatory: true,

  supersedesTplSubtaskId: '6c8ad09c-0b56-4ee6-ba2e-891fd952dff1',

  titleBuilder: (ctx) => {
    const name = ctx.owner?.name?.trim() || 'empresa'
    return `Naturalidade do rep. legal — ${name}`
  },

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Naturalidade do representante legal',
      field_name: 'legal_rep_naturality',
      field_type: 'text',
      order_index: 0,
      target_entity: 'owner',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
