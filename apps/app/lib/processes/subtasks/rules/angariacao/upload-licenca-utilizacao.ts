import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Imóvel: upload da Licença de Utilização.
 *
 * Opcional: imóveis anteriores a 07/08/1951 não a têm. O `hint` torna
 * isto visível no card sem precisar de lógica condicional no front-end.
 */
export const uploadLicencaUtilizacaoRule: SubtaskRule = {
  key: 'upload_licenca_utilizacao',
  description: 'Upload da Licença de Utilização (condicional a post-1951).',
  taskKind: 'Documentos do Imóvel',
  ownerScope: 'none',
  isMandatory: false,
  hint: 'Obrigatório para imóveis posteriores a 07 de Agosto de 1951',

  supersedesTplSubtaskId: '9f2f1ec0-6575-4814-ab57-2bb1b9e7ad09',

  titleBuilder: () => 'Licença de Utilização',

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: 'b326071d-8e8c-43e4-b74b-a377e76b94dc',
  }),

  Component: null,
  complete: async () => ({}),
}
