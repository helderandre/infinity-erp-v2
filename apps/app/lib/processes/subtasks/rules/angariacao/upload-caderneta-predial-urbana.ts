import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Imóvel: upload da Caderneta Predial Urbana.
 */
export const uploadCadernetaPredialUrbanaRule: SubtaskRule = {
  key: 'upload_caderneta_predial_urbana',
  description: 'Upload da Caderneta Predial Urbana (CPU) do imóvel.',
  taskKind: 'Documentos do Imóvel',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '53c3346c-bc4e-4a45-b9d9-ae069661e9b1',

  titleBuilder: () => 'Caderneta Predial Urbana',

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: '5da10e4a-80bb-4f24-93a8-1e9731e20071',
  }),

  Component: null,
  complete: async () => ({}),
}
