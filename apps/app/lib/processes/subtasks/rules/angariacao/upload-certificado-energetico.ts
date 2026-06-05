import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Imóvel: upload do Certificado Energético.
 * Sem owner (ownerScope:'none') — documento do próprio imóvel.
 */
export const uploadCertificadoEnergeticoRule: SubtaskRule = {
  key: 'upload_certificado_energetico',
  description: 'Upload do Certificado Energético do imóvel.',
  taskKind: 'Documentos do Imóvel',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '6ce347d7-83ce-43b1-b5cc-cde0f8f77703',

  titleBuilder: () => 'Certificado Energético',

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: 'b201aa0e-fa71-4ca7-88d7-1372bd351aa5',
  }),

  Component: null,
  complete: async () => ({}),
}
