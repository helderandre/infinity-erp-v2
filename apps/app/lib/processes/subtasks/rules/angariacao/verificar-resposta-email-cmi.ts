import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Verificar Resposta do Email" (`b0b670ba-...`)
 * — checklist pós-envio do CMI. Tem `dueRule` declarativa: 24h depois
 * do envio, shifted para o próximo dia útil.
 */
export const verificarRespostaEmailCmiRule: SubtaskRule = {
  key: 'verificar_resposta_email_cmi',
  description:
    'Checklist: verificar se o proprietário respondeu ao email com o CMI em 24h.',
  taskKind: 'Enviar CMI ao proprietário',
  ownerScope: 'main_contact_only',
  personTypeFilter: 'all',
  isMandatory: true,

  supersedesTplSubtaskId: 'b0b670ba-e637-454d-9bef-bfae371a803f',

  dueRule: {
    after: 'email_envio_cmi',
    offset: '24h',
    shiftOnNonBusinessDay: true,
  },

  titleBuilder: () => 'Verificar resposta do email CMI',

  configBuilder: () => ({ type: 'checklist' }),

  Component: null,
  complete: async () => ({}),
}
