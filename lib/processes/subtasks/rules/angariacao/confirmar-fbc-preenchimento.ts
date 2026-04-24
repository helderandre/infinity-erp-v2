import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Confirmar o correto preenchimento da FBC"
 * (`a61c2c71-...`) — checklist de verificação da Ficha de Branqueamento
 * de Capitais.
 */
export const confirmarFbcPreenchimentoRule: SubtaskRule = {
  key: 'confirmar_fbc_preenchimento',
  description: 'Checklist: conferir correcto preenchimento da FBC.',
  taskKind: 'Confirmação dos dados do CMI e FBC',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: 'a61c2c71-8f7e-4996-93a6-b917301b48b8',

  titleBuilder: () => 'Confirmar preenchimento da FBC',

  configBuilder: () => ({ type: 'checklist' }),

  Component: null,
  complete: async () => ({}),
}
