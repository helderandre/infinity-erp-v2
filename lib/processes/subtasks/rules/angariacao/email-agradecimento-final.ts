import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Enviar Email de Agradecimento" (`465cc353-...`)
 * — último passo: email ao cliente agradecendo a confiança e
 * comunicando os links dos portais onde o imóvel ficou publicado.
 *
 * `email_library_id: '8829ca88-...'` → "Agradecimento pela Confiança
 * na Nossa Equipe Imobiliária - INFINITY GROUP".
 */
export const emailAgradecimentoFinalRule: SubtaskRule = {
  key: 'email_agradecimento_final',
  description: 'Email final de agradecimento ao cliente após publicação da angariação.',
  taskKind: 'E-mail de agradecimento',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '465cc353-4e2e-4893-8b27-4fa3e0b46615',

  titleBuilder: () => 'Email de agradecimento',

  configBuilder: () => ({
    type: 'email',
    email_library_id: '8829ca88-8848-47ec-8149-62a126f829fb',
  }),

  Component: null,
  complete: async () => ({}),
}
