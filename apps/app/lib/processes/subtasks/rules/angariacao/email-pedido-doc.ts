import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui a subtarefa legacy "Pedido de Documentação"
 * (tpl_subtask_id `cff4c3ac-...`) por uma linha hardcoded que reusa a UI
 * de email legacy (`<SubtaskCardEmail>` + `<SubtaskEmailSheet>`).
 *
 * - `Component: null` → rendering delega no switch legacy de
 *   `subtask-card-list.tsx`, que lê `config.type === 'email'`.
 * - `supersedesTplSubtaskId` → apaga a row legacy criada pelo
 *   `_populate_subtasks` durante a aprovação antes de inserir a hardcoded.
 * - `configBuilder` → popula `config` com variantes por person_type para
 *   o sheet resolver a template library correcta.
 * - `complete` é no-op — o sheet legacy trata de marcar a subtask
 *   concluída + escrever em `log_emails` + emitir activity `'email_sent'`.
 */
export const emailPedidoDocRule: SubtaskRule = {
  key: 'email_pedido_doc',
  description:
    'Email ao proprietário com a lista de documentos necessários (substitui o tpl_subtask "Pedido de Documentação").',
  taskKind: 'Enviar e-mail ao cliente com pedido de documento',
  repeatPerOwner: true,
  isMandatory: true,

  supersedesTplSubtaskId: 'cff4c3ac-af4f-454e-951b-f1bbdb0cb178',

  titleBuilder: (ctx) => {
    const firstName =
      ctx.owner?.name?.trim().split(/\s+/)[0] || 'proprietário'
    return `Email - ${firstName}`
  },

  configBuilder: () => ({
    // Shape consumido pelo switch legacy em subtask-card-list.tsx
    // (case 'email') e por SubtaskEmailSheet.getEmailLibraryId().
    type: 'email',
    has_person_type_variants: true,
    singular_config: {
      email_library_id: '450c31c0-723d-4d79-8a2a-580e55b4f63f', // Pedido Singular
    },
    coletiva_config: {
      email_library_id: '1cbdd950-a716-4266-9e18-5087c0864c77', // Pedido Coletivo
    },
  }),

  Component: null,

  complete: async () => {
    // No-op: o fluxo legacy (sheet → PUT .../subtasks/[id] com is_completed:true)
    // trata de persistência, log_emails e activity 'email_sent'.
    return {}
  },
}
