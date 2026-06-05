import type { SubtaskRule } from '../../types'

/**
 * Rule HYBRID — Grupo Pessoa Colectiva: Certidão Comercial da Empresa.
 * 1 linha por owner com `person_type='coletiva'`.
 *
 * NOTA: o label "Certidão Comercial" é sinónimo comercial de "Certidão
 * Permanente da Empresa" (doc_type `e433c9f1-...` em `doc_types`).
 */
export const uploadCertidaoComercialEmpresaRule: SubtaskRule = {
  key: 'upload_certidao_comercial_empresa',
  description: 'Upload da Certidão Comercial/Permanente da empresa (1 por owner coletivo).',
  taskKind: 'Documentos Pessoa Colectiva',
  ownerScope: 'all',
  personTypeFilter: 'coletiva',
  isMandatory: true,
  hint: 'Código de acesso válido',

  supersedesTplSubtaskId: '40643317-ca4e-456d-aa2b-325489c5d9ce',

  titleBuilder: (ctx) => {
    const name = ctx.owner?.name?.trim() || 'empresa'
    return `Certidão Comercial — ${name}`
  },

  configBuilder: () => ({
    type: 'upload',
    doc_type_id: 'e433c9f1-b323-43ac-9607-05b31f72bbb9',
  }),

  Component: null,
  complete: async () => ({}),
}
