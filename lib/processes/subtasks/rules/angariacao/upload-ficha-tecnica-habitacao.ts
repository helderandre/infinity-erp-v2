import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Imóvel: upload da Ficha Técnica de Habitação.
 * Opcional: só imóveis post-2004.
 */
export const uploadFichaTecnicaHabitacaoRule: SubtaskRule = {
  key: 'upload_ficha_tecnica_habitacao',
  description: 'Upload da Ficha Técnica de Habitação (condicional a post-2004).',
  taskKind: 'Documentos do Imóvel',
  ownerScope: 'none',
  isMandatory: false,
  hint: 'Obrigatória para imóveis posteriores a 1 de Abril de 2004',

  supersedesTplSubtaskId: '583e1160-9508-45fe-a9da-2023baaea606',

  titleBuilder: () => 'Ficha Técnica de Habitação',

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: 'f4df68d0-f833-4d18-ad61-f30c699c22d6',
  }),

  Component: null,
  complete: async () => ({}),
}
