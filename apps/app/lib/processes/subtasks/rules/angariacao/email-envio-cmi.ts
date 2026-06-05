import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Envio de Email CMI" (`4b63440b-...`) — email
 * ao contacto principal com o CMI gerado.
 *
 * NOTA: `email_library_id: '1bf9cf39-...'` pode não existir em
 * `tpl_email_library` (ver INVENTORY-ANGARIACAO-SUBTASKS.md §01.4.1).
 * Se o sheet legacy falhar a resolver a template, editar o id ou
 * criar a template em falta na biblioteca.
 */
export const emailEnvioCmiRule: SubtaskRule = {
  key: 'email_envio_cmi',
  description: 'Email ao contacto principal com o CMI em anexo.',
  taskKind: 'Enviar CMI ao proprietário',
  ownerScope: 'main_contact_only',
  personTypeFilter: 'all',
  isMandatory: true,

  supersedesTplSubtaskId: '4b63440b-57ea-4eed-9403-a0baf62a8391',

  titleBuilder: (ctx) => {
    const first = ctx.owner?.name?.trim().split(/\s+/)[0] || 'principal'
    return `Envio CMI - ${first}`
  },

  configBuilder: () => ({
    type: 'email',
    email_library_id: '1bf9cf39-963a-45cb-bf46-2a08beef49bd',
  }),

  Component: null,
  complete: async () => ({}),
}
