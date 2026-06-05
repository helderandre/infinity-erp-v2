import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Criar o Draft no MaxWork" (`0d998ff1-...`) —
 * checklist manual (consultor cria o draft no portal MaxWork da Remax).
 */
export const checklistDraftMaxworkRule: SubtaskRule = {
  key: 'checklist_draft_maxwork',
  description:
    'Checklist: consultor cria o draft do imóvel no MaxWork (portal Remax).',
  taskKind: 'Draft do Imóvel',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '0d998ff1-f8ec-43cf-b3b9-c5f4abbdd7e6',

  titleBuilder: () => 'Criar Draft no MaxWork',

  configBuilder: () => ({ type: 'checklist' }),

  Component: null,
  complete: async () => ({}),
}
