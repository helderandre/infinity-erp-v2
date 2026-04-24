import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Pessoa Singular: estado civil de cada owner
 * singular. Escreve em `owners.marital_status`.
 */
export const fieldEstadoCivilSingularRule: SubtaskRule = {
  key: 'field_estado_civil_singular',
  description: 'Estado civil de cada owner singular.',
  taskKind: 'Documentos Pessoa Singular',
  ownerScope: 'all',
  personTypeFilter: 'singular',
  isMandatory: true,

  supersedesTplSubtaskId: '0299644f-b790-4570-8b3d-c082cd15819c',

  titleBuilder: (ctx) => {
    const first = ctx.owner?.name?.trim().split(/\s+/)[0] || 'proprietário'
    return `Estado civil — ${first}`
  },

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Estado civil',
      field_name: 'marital_status',
      field_type: 'text',
      order_index: 0,
      target_entity: 'owner',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
