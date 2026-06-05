import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Confirmar Recolha" (`3bfd3a9b-...`) —
 * checklist pós-agendamento do levantamento CMI+FBC.
 */
export const confirmarRecolhaCmiFbcRule: SubtaskRule = {
  key: 'confirmar_recolha_cmi_fbc',
  description: 'Checklist: confirmar recolha física do CMI e FBC assinados.',
  taskKind: 'Recolha do CMI e FBC',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '3bfd3a9b-9f94-414e-85f2-1bf146dd5d24',

  titleBuilder: () => 'Confirmar recolha do CMI e FBC',

  configBuilder: () => ({ type: 'checklist' }),

  Component: null,
  complete: async () => ({}),
}
