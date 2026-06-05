import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Imóvel: campo para valor aproximado da hipoteca
 * em dívida (se aplicável). Escreve em `dev_property_internal.mortgage_balance`.
 */
export const fieldPropertyHipotecaDividaRule: SubtaskRule = {
  key: 'field_property_hipoteca_divida',
  description: 'Campo currency para valor aproximado de hipoteca em dívida.',
  taskKind: 'Documentos do Imóvel',
  ownerScope: 'none',
  isMandatory: false,
  hint: 'Indicar se existe hipoteca e, em caso afirmativo, valor aproximado em dívida',

  supersedesTplSubtaskId: 'fbfd52c0-3563-47d0-92c6-4b2bc76d4cb1',

  titleBuilder: () => 'Hipoteca — valor em dívida (se aplicável)',

  configBuilder: () => ({
    type: 'field',
    field: {
      label: 'Hipoteca em dívida',
      field_name: 'mortgage_balance',
      field_type: 'currency',
      order_index: 0,
      target_entity: 'property_internal',
    },
  }),

  Component: null,
  complete: async () => ({}),
}
