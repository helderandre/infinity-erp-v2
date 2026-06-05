import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Imóvel: upload da Planta do Imóvel.
 */
export const uploadPlantaImovelRule: SubtaskRule = {
  key: 'upload_planta_imovel',
  description: 'Upload da planta arquitectónica / de localização do imóvel.',
  taskKind: 'Documentos do Imóvel',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '29808967-d884-4502-9d2d-46c540eba9c4',

  titleBuilder: () => 'Planta do Imóvel',

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: 'afde278e-3c7e-4214-a779-588778023dc6',
  }),

  Component: null,
  complete: async () => ({}),
}
