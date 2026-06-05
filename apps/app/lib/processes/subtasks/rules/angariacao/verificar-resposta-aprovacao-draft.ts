import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Verificar resposta de Email em até 24h"
 * (`d4805618-...`) — checklist com `dueRule` declarativa 24h após o
 * envio do email a pedir aprovação.
 */
export const verificarRespostaAprovacaoDraftRule: SubtaskRule = {
  key: 'verificar_resposta_aprovacao_draft',
  description:
    'Checklist pós-envio do email ao processual: verificar resposta em 24h.',
  taskKind: 'Enviar e-mail para processual Infinity',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: 'd4805618-68e0-48d1-8c40-48902c7d6f5a',

  dueRule: {
    after: 'email_aprovacao_draft_processual',
    offset: '24h',
    shiftOnNonBusinessDay: true,
  },

  titleBuilder: () => 'Verificar resposta (24h)',

  configBuilder: () => ({ type: 'checklist' }),

  Component: null,
  complete: async () => ({}),
}
