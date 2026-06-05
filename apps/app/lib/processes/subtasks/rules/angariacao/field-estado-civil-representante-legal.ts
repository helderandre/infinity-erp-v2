import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Pessoa Colectiva: campo estado civil do
 * representante legal. Escreve em `owners.legal_rep_marital_status`.
 */
export const fieldEstadoCivilRepresentanteLegalRule: SubtaskRule = {
  key: 'field_estado_civil_representante_legal',
  description: 'Estado civil do representante legal da empresa.',
  taskKind: 'Documentos Pessoa Colectiva',
  ownerScope: 'all',
  personTypeFilter: 'coletiva',
  isMandatory: true,

  supersedesTplSubtaskId: '513d9492-3dc6-4df0-964d-a59443c03eca',

  titleBuilder: (ctx) => {
    const name = ctx.owner?.name?.trim() || 'empresa'
    return `Estado civil do rep. legal — ${name}`
  },

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Estado civil do representante legal',
      field_name: 'legal_rep_marital_status',
      field_type: 'text',
      order_index: 0,
      target_entity: 'owner',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
