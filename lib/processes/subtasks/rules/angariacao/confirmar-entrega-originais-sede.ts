import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Confirmar" (`1920bbe2-...`) — checklist
 * genérico. Task pai "Digitalizar Originais" menciona entrega física
 * na sede da ConviCtus; o título de subtarefa é demasiado genérico no
 * legacy (ver INVENTORY-ANGARIACAO-SUBTASKS.md §01.8.1).
 */
export const confirmarEntregaOriginaisSedeRule: SubtaskRule = {
  key: 'confirmar_entrega_originais_sede',
  description:
    'Checklist: confirmar entrega física dos originais CMI/FBC na sede (ConviCtus).',
  taskKind: 'Digitalizar Originais',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '1920bbe2-ea78-4fda-9959-76bec0be31bc',

  titleBuilder: () => 'Entrega dos originais na sede',

  configBuilder: () => ({ type: 'checklist' }),

  Component: null,
  complete: async () => ({}),
}
