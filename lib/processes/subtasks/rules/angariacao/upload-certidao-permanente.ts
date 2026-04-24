import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Imóvel: upload da Certidão Permanente (CRP) do imóvel.
 */
export const uploadCertidaoPermanenteRule: SubtaskRule = {
  key: 'upload_certidao_permanente',
  description: 'Upload da Certidão Permanente (CRP) do imóvel.',
  taskKind: 'Documentos do Imóvel',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: 'e80ebf6f-7add-444d-b890-58923efcf73f',

  titleBuilder: () => 'Certidão Permanente',

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: '09eac23e-8d32-46f3-9ad8-f579d8d8bf9f',
  }),

  Component: null,
  complete: async () => ({}),
}
