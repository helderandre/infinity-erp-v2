import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Pessoa Singular: naturalidade (freguesia e
 * concelho) de cada owner singular. Escreve em `owners.naturality`.
 */
export const fieldNaturalidadeSingularRule: SubtaskRule = {
  key: 'field_naturalidade_singular',
  description: 'Naturalidade (freguesia e concelho) de cada owner singular.',
  taskKind: 'Documentos Pessoa Singular',
  ownerScope: 'all',
  personTypeFilter: 'singular',
  isMandatory: true,

  supersedesTplSubtaskId: '05475f91-3eba-4575-bab6-3e45eddcdccb',

  titleBuilder: (ctx) => {
    const first = ctx.owner?.name?.trim().split(/\s+/)[0] || 'proprietário'
    return `Naturalidade — ${first}`
  },

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Naturalidade (freguesia e concelho)',
      field_name: 'naturality',
      field_type: 'text',
      order_index: 0,
      target_entity: 'owner',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
