import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Pessoa Singular: morada actual de cada owner
 * singular. Escreve em `owners.address`.
 */
export const fieldMoradaAtualSingularRule: SubtaskRule = {
  key: 'field_morada_atual_singular',
  description: 'Morada actual de cada owner singular.',
  taskKind: 'Documentos Pessoa Singular',
  ownerScope: 'all',
  personTypeFilter: 'singular',
  isMandatory: true,

  supersedesTplSubtaskId: '91dffeea-d31a-4a30-af2e-ac56a4558e87',

  titleBuilder: (ctx) => {
    const first = ctx.owner?.name?.trim().split(/\s+/)[0] || 'proprietário'
    return `Morada atual — ${first}`
  },

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Morada atual',
      field_name: 'address',
      field_type: 'textarea',
      order_index: 0,
      target_entity: 'owner',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
