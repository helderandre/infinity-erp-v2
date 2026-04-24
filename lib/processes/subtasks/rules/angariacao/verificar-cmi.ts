import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Verificar CMI" (`bd8850f3-...`) — checklist
 * sem owner_scope, corre após `geracao_cmi`.
 */
export const verificarCmiRule: SubtaskRule = {
  key: 'verificar_cmi',
  description:
    'Checklist de verificação do rascunho do CMI antes de o enviar ao proprietário.',
  taskKind: 'Geração do CMI',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: 'bd8850f3-5937-419d-a751-46a044e30755',

  titleBuilder: () => 'Verificar CMI',

  configBuilder: () => ({ type: 'checklist' }),

  Component: null,
  complete: async () => ({}),
}
