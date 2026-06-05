import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID: substitui "Digitalizar CMI Original" (`9436ce84-...`) —
 * upload da digitalização do CMI físico assinado.
 *
 * `doc_type: 7b3f2510-...` → "CMI Digitalizado" (distinto do
 * `doc_library` do CMI gerado em §01.3.1).
 */
export const uploadCmiDigitalizadoRule: SubtaskRule = {
  key: 'upload_cmi_digitalizado',
  description: 'Upload da digitalização do CMI físico assinado pelo proprietário.',
  taskKind: 'Digitalizar Originais',
  ownerScope: 'none',
  isMandatory: true,

  supersedesTplSubtaskId: '9436ce84-1bf7-4115-99ea-74ed1703ae68',

  titleBuilder: () => 'Digitalizar CMI original',

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: '7b3f2510-c470-4845-85ad-1af3dd781e62',
  }),

  Component: null,
  complete: async () => ({}),
}
