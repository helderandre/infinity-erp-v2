import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui a subtarefa legacy "Gerar CMI"
 * (tpl_subtask_id `3ac7e230-...`) por uma linha hardcoded que reusa a UI
 * legacy de `generate_doc` (`<SubtaskCardDoc>` + `<SubtaskDocSheet>` /
 * `<SubtaskPdfSheet>`).
 *
 * - `ownerScope: 'main_contact_only'` → 1 linha só, `owner_id` =
 *   contacto principal do imóvel (mesmo comportamento do tpl_subtask
 *   original que tinha `owner_scope: 'main_contact_only'`).
 * - `Component: null` + `configBuilder` com `type: 'generate_doc'` →
 *   delega rendering no switch legacy.
 * - `supersedesTplSubtaskId` → apaga a row legacy criada pelo
 *   `_populate_subtasks` antes de inserir a hardcoded.
 *
 * `dueRule` imperativa: 24h depois de `email_pedido_doc`, nunca antes
 * das 9h UTC do próximo dia útil (≈ 9-10h local PT).
 */
export const geracaoCmiRule: SubtaskRule = {
  key: 'geracao_cmi',
  description:
    'Gerar rascunho do Contrato de Mediação Imobiliária (CMI) para o contacto principal.',
  taskKind: 'Geração do CMI',
  ownerScope: 'main_contact_only',
  isMandatory: true,

  supersedesTplSubtaskId: '3ac7e230-9459-46e1-ac06-1c02ada73fe3',

  titleBuilder: (ctx) => {
    const firstName =
      ctx.owner?.name?.trim().split(/\s+/)[0] || 'contacto principal'
    return `CMI - ${firstName}`
  },

  configBuilder: () => ({
    // Shape consumido pelo switch legacy em subtask-card-list.tsx
    // (case 'generate_doc') e por SubtaskDocSheet / SubtaskPdfSheet.
    type: 'generate_doc',
    doc_library_id: '9223bdfc-31a0-4918-b5ee-580760ba8b32', // "CMI"
  }),

  dueRule: async ({ prereqCompletedAt, businessDay }) => {
    const raw = new Date(prereqCompletedAt.getTime())
    raw.setUTCHours(raw.getUTCHours() + 24)
    const shifted = await businessDay(raw)
    if (shifted.getUTCHours() < 9) {
      shifted.setUTCHours(9, 0, 0, 0)
    }
    return shifted
  },

  Component: null,

  complete: async () => {
    // No-op: o sheet legacy (SubtaskDocSheet/PdfSheet) chama o PUT
    // tradicional `/subtasks/[id]` que grava rendered_content +
    // is_completed=true e emite activity 'doc_generated'/'completed'.
    return {}
  },
}
