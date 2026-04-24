import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Confirmar o correto preenchimento do CPCV"
 * (`f4381b61-...`). NOTA: título no template diz "CPCV" mas a task é
 * sobre CMI+FBC — inconsistência legacy preservada (ver
 * INVENTORY-ANGARIACAO-SUBTASKS.md §01.7.1). Renomear aqui exige
 * data migration do `subtask_key`.
 */
export const confirmarCmiPreenchimentoRule: SubtaskRule = {
  key: 'confirmar_cmi_preenchimento',
  description:
    'Checklist: conferir correcto preenchimento do CMI (título legacy menciona CPCV — inconsistência).',
  taskKind: 'Confirmação dos dados do CMI e FBC',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: 'f4381b61-0102-43ee-8b35-13a4ab186f40',

  titleBuilder: () => 'Confirmar preenchimento do CMI',

  configBuilder: () => ({ type: 'checklist' }),

  Component: null,
  complete: async () => ({}),
}
