import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Pessoa Colectiva: campo morada actual do
 * representante legal. Escreve em `owners.legal_rep_address`.
 */
export const fieldMoradaRepresentanteLegalRule: SubtaskRule = {
  key: 'field_morada_representante_legal',
  description: 'Morada actual do representante legal da empresa.',
  taskKind: 'Documentos Pessoa Colectiva',
  ownerScope: 'all',
  personTypeFilter: 'coletiva',
  isMandatory: true,

  supersedesTplSubtaskId: '8528c0d0-c551-4f59-8a1a-34b19be78f17',

  titleBuilder: (ctx) => {
    const name = ctx.owner?.name?.trim() || 'empresa'
    return `Morada do rep. legal — ${name}`
  },

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Morada atual do representante legal',
      field_name: 'legal_rep_address',
      field_type: 'textarea',
      order_index: 0,
      target_entity: 'owner',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
