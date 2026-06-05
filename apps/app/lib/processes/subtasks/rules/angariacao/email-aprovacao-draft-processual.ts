import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Enviar e-mail para processual.convictus@remax.pt
 * ... a solicitar aprovação do Draft" (`5d39134b-...`).
 *
 * Porque é `type: 'checklist'` e não `type: 'email'`:
 *   Não existe template em `tpl_email_library` para este pedido de
 *   aprovação, pelo que o legacy modela a subtarefa como checklist —
 *   o consultor envia o email manualmente (cliente de email externo)
 *   e marca a subtarefa como concluída aqui. Comportamento preservado.
 *
 * Para converter em envio real via sheet de email:
 *   1. Criar entrada em `tpl_email_library` (destinatário fixo
 *      `processual.convictus@remax.pt`, subject + body_html).
 *   2. Trocar `configBuilder` para:
 *        type: 'email',
 *        email_library_id: '<uuid-do-novo-template>',
 *   3. O `SubtaskCardEmail` + `SubtaskEmailSheet` passa a abrir
 *      automaticamente; `verificar_resposta_aprovacao_draft` continua
 *      a propagar `due_date` pelo `subtask_key` (inalterado).
 *
 * Ver INVENTORY-ANGARIACAO-SUBTASKS.md §03.2.1.
 */
export const emailAprovacaoDraftProcessualRule: SubtaskRule = {
  key: 'email_aprovacao_draft_processual',
  description:
    'Checklist (legacy) de envio manual do email ao processual ConviCtus a pedir aprovação do Draft. Convertível para email real no futuro.',
  taskKind: 'Enviar e-mail para processual Infinity',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '5d39134b-ca89-4d4d-83e2-8ca218a46484',

  titleBuilder: () => 'Enviar email a pedir aprovação do Draft',

  configBuilder: () => ({ type: 'checklist' }),

  Component: null,
  complete: async () => ({}),
}
