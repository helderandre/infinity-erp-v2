// Requisitos do CMI (Contrato de Mediação Imobiliária) por scope.
// Inclui tanto documentos (upload no doc_registry) como campos estruturados
// (no imóvel ou no proprietário). A função computeCmiReadiness cruza o
// estado actual com os requisitos e devolve o que falta.

import type { PropertyDetail } from '@/types/property'
import type { Database } from '@/types/database'

type OwnerRow = Database['public']['Tables']['owners']['Row']

// tpl_task_id da task "Armazenar documentos" no template canónico "Processo de Angariações".
// Quando uma proc_task herda deste tpl_task_id, a UI renderiza <PropertyCmiReadiness>
// em vez das subtasks dinâmicas.
export const ACQUISITION_STORE_DOCS_TPL_TASK_ID = 'c51cf081-06cc-4d70-80a9-9e97563cc776'

// IDs dos doc_types (espelham app/api/documents/classify/route.ts).
export const DOC_TYPE_IDS = {
  CERTIFICADO_ENERGETICO: 'b201aa0e-fa71-4ca7-88d7-1372bd351aa5',
  CADERNETA_PREDIAL: '5da10e4a-80bb-4f24-93a8-1e9731e20071',
  CERTIDAO_PERMANENTE: '09eac23e-8d32-46f3-9ad8-f579d8d8bf9f',
  LICENCA_UTILIZACAO: 'b326071d-8e8c-43e4-b74b-a377e76b94dc',
  FICHA_TECNICA: 'f4df68d0-f833-4d18-ad61-f30c699c22d6',
  PLANTA: 'afde278e-3c7e-4214-a779-588778023dc6',
  CARTAO_CIDADAO: '16706cb5-1a27-413d-ad75-ec6aee1c3674',
  FICHA_BRANQUEAMENTO: '02b63b46-d5ed-4314-9e83-1447095f8a15',
  CERTIDAO_PERMANENTE_EMPRESA: 'e433c9f1-b323-43ac-9607-05b31f72bbb9',
  RCBE: '6dd8bf4c-d354-4e0e-8098-eda5a8767fd1',
  FICHA_BRANQUEAMENTO_EMPRESA: 'f9a3ee8f-04a6-40f0-aae0-021ae7c48c6d',
  ATA_CONDOMINIO: '2a5b7e90-1c3d-4f6a-8b9c-0d1e2f3a4b5c',
} as const

export type CmiScope = 'property' | 'owner_singular' | 'owner_coletiva'

export interface PropertyRequirement {
  kind: 'document' | 'field'
  key: string
  label: string
  description?: string
  docTypeId?: string
  isFilled?: (p: PropertyDetail) => boolean
  requiredIf?: (p: PropertyDetail) => boolean
}

export interface OwnerRequirement {
  kind: 'document' | 'field'
  key: string
  label: string
  description?: string
  docTypeId?: string
  isFilled?: (o: OwnerRow) => boolean
  requiredIf?: (o: OwnerRow) => boolean
}

const getConstructionYear = (p: PropertyDetail): number | null =>
  p.dev_property_specifications?.construction_year ?? null

export const PROPERTY_CMI_REQUIREMENTS: PropertyRequirement[] = [
  {
    kind: 'document',
    key: 'certificado-energetico',
    label: 'Certificado Energético',
    docTypeId: DOC_TYPE_IDS.CERTIFICADO_ENERGETICO,
  },
  {
    kind: 'document',
    key: 'caderneta-predial',
    label: 'Caderneta Predial Urbana',
    docTypeId: DOC_TYPE_IDS.CADERNETA_PREDIAL,
  },
  {
    kind: 'document',
    key: 'certidao-permanente',
    label: 'Certidão Permanente',
    docTypeId: DOC_TYPE_IDS.CERTIDAO_PERMANENTE,
  },
  {
    kind: 'document',
    key: 'licenca-utilizacao',
    label: 'Licença de Utilização',
    description: 'Obrigatório para imóveis posteriores a 07 de Agosto de 1951',
    docTypeId: DOC_TYPE_IDS.LICENCA_UTILIZACAO,
    requiredIf: (p) => {
      const year = getConstructionYear(p)
      // Se ano desconhecido, assumir obrigatório (conservador).
      return year == null || year > 1951
    },
  },
  {
    kind: 'document',
    key: 'ficha-tecnica',
    label: 'Ficha Técnica de Habitação',
    description: 'Obrigatória para imóveis posteriores a 1 de Abril de 2004',
    docTypeId: DOC_TYPE_IDS.FICHA_TECNICA,
    requiredIf: (p) => {
      const year = getConstructionYear(p)
      // Só temos o ano; usamos >= 2004. Se ano desconhecido, assume obrigatória.
      return year == null || year >= 2004
    },
  },
  {
    kind: 'document',
    key: 'planta',
    label: 'Planta do Imóvel',
    docTypeId: DOC_TYPE_IDS.PLANTA,
  },
  {
    kind: 'document',
    key: 'ata-condominio',
    label: 'Última Ata do Condomínio',
    description: 'Aplicável apenas a imóveis em condomínio',
    docTypeId: DOC_TYPE_IDS.ATA_CONDOMINIO,
    requiredIf: (p) =>
      (p.dev_property_internal?.condominium_fee ?? 0) > 0,
  },
  {
    kind: 'field',
    key: 'hipoteca',
    label: 'Hipoteca — valor em dívida (se aplicável)',
    description: 'Indicar se existe hipoteca e, em caso afirmativo, valor aproximado em dívida',
    isFilled: (p) => {
      const internal = p.dev_property_internal as
        | (NonNullable<PropertyDetail['dev_property_internal']> & {
            has_mortgage?: boolean | null
            mortgage_owed?: number | null
          })
        | null
      const has = internal?.has_mortgage
      if (has === false) return true
      if (has === true && internal?.mortgage_owed != null && internal.mortgage_owed > 0) {
        return true
      }
      return false
    },
  },
]

const hasValue = (v: unknown): boolean =>
  v != null && !(typeof v === 'string' && v.trim() === '')

const ownerFields = {
  naturality: {
    kind: 'field' as const,
    key: 'naturality',
    label: 'Naturalidade (freguesia e concelho)',
    isFilled: (o: OwnerRow) => hasValue(o.naturality),
  },
  address: {
    kind: 'field' as const,
    key: 'address',
    label: 'Morada atual',
    isFilled: (o: OwnerRow) => hasValue(o.address),
  },
  maritalStatus: {
    kind: 'field' as const,
    key: 'marital-status',
    label: 'Estado civil',
    isFilled: (o: OwnerRow) => hasValue(o.marital_status),
  },
  maritalRegime: {
    kind: 'field' as const,
    key: 'marital-regime',
    label: 'Regime de casamento',
    isFilled: (o: OwnerRow) => hasValue((o as any).marital_regime),
    requiredIf: (o: OwnerRow) =>
      (o.marital_status ?? '').toLowerCase() === 'casado' ||
      (o.marital_status ?? '').toLowerCase() === 'casada',
  },
}

export const OWNER_SINGULAR_REQUIREMENTS: OwnerRequirement[] = [
  {
    kind: 'document',
    key: 'cc-passaporte',
    label: 'Cartão de Cidadão / Passaporte',
    docTypeId: DOC_TYPE_IDS.CARTAO_CIDADAO,
  },
  ownerFields.naturality,
  ownerFields.address,
  ownerFields.maritalStatus,
  ownerFields.maritalRegime,
  {
    kind: 'document',
    key: 'ficha-branqueamento',
    label: 'Ficha de Branqueamento de Capitais',
    description: 'Uma por proprietário, mesmo em caso de casados',
    docTypeId: DOC_TYPE_IDS.FICHA_BRANQUEAMENTO,
  },
]

export const OWNER_COLETIVA_REQUIREMENTS: OwnerRequirement[] = [
  {
    kind: 'document',
    key: 'certidao-permanente-empresa',
    label: 'Certidão Comercial da Empresa',
    description: 'Código de acesso válido',
    docTypeId: DOC_TYPE_IDS.CERTIDAO_PERMANENTE_EMPRESA,
  },
  {
    kind: 'document',
    key: 'rcbe',
    label: 'RCBE',
    description: 'Código de acesso válido',
    docTypeId: DOC_TYPE_IDS.RCBE,
  },
  {
    kind: 'document',
    key: 'cc-rep-legal',
    label: 'CC / Passaporte do representante legal',
    docTypeId: DOC_TYPE_IDS.CARTAO_CIDADAO,
  },
  { ...ownerFields.naturality, label: 'Naturalidade do representante legal' },
  { ...ownerFields.address, label: 'Morada atual do representante legal' },
  { ...ownerFields.maritalStatus, label: 'Estado civil do representante legal' },
  { ...ownerFields.maritalRegime, label: 'Regime de casamento (se casado)' },
  {
    kind: 'document',
    key: 'ficha-branqueamento-empresa',
    label: 'Ficha de Branqueamento (Empresa)',
    docTypeId: DOC_TYPE_IDS.FICHA_BRANQUEAMENTO_EMPRESA,
  },
]

// ── Compute readiness ────────────────────────────────────────────────

export interface DocRef {
  id: string
  owner_id?: string | null
  property_id?: string | null
  doc_type: { id: string } | null
}

export type ComputedStatus = 'satisfied' | 'missing' | 'na'

export interface ComputedRequirement {
  key: string
  label: string
  description?: string
  kind: 'document' | 'field'
  docTypeId?: string
  status: ComputedStatus
}

export interface OwnerReadiness {
  ownerId: string
  ownerName: string
  personType: 'singular' | 'coletiva'
  items: ComputedRequirement[]
  satisfiedCount: number
  requiredCount: number
}

export interface CmiReadiness {
  property: ComputedRequirement[]
  propertySatisfiedCount: number
  propertyRequiredCount: number
  owners: OwnerReadiness[]
  totalSatisfied: number
  totalRequired: number
}

function matchDoc(docs: DocRef[], docTypeId: string, ownerId?: string): boolean {
  return docs.some((d) => {
    if (d.doc_type?.id !== docTypeId) return false
    if (ownerId) return d.owner_id === ownerId
    return true
  })
}

export function computeCmiReadiness(
  property: PropertyDetail,
  allDocs: DocRef[]
): CmiReadiness {
  // Property section
  const propItems: ComputedRequirement[] = PROPERTY_CMI_REQUIREMENTS.map((req) => {
    const required = req.requiredIf ? req.requiredIf(property) : true
    if (!required) {
      return {
        key: req.key,
        label: req.label,
        description: req.description,
        kind: req.kind,
        docTypeId: req.docTypeId,
        status: 'na',
      }
    }
    const satisfied =
      req.kind === 'document'
        ? matchDoc(allDocs, req.docTypeId!)
        : !!req.isFilled?.(property)
    return {
      key: req.key,
      label: req.label,
      description: req.description,
      kind: req.kind,
      docTypeId: req.docTypeId,
      status: satisfied ? 'satisfied' : 'missing',
    }
  })

  // Owners section
  const owners: OwnerReadiness[] = []
  for (const po of property.property_owners || []) {
    const owner = po.owners
    if (!owner) continue
    const reqs =
      owner.person_type === 'coletiva'
        ? OWNER_COLETIVA_REQUIREMENTS
        : OWNER_SINGULAR_REQUIREMENTS

    const items: ComputedRequirement[] = reqs.map((req) => {
      const required = req.requiredIf ? req.requiredIf(owner) : true
      if (!required) {
        return {
          key: req.key,
          label: req.label,
          description: req.description,
          kind: req.kind,
          docTypeId: req.docTypeId,
          status: 'na',
        }
      }
      const satisfied =
        req.kind === 'document'
          ? matchDoc(allDocs, req.docTypeId!, owner.id)
          : !!req.isFilled?.(owner)
      return {
        key: req.key,
        label: req.label,
        description: req.description,
        kind: req.kind,
        docTypeId: req.docTypeId,
        status: satisfied ? 'satisfied' : 'missing',
      }
    })

    const satisfiedCount = items.filter((i) => i.status === 'satisfied').length
    const requiredCount = items.filter((i) => i.status !== 'na').length

    owners.push({
      ownerId: owner.id,
      ownerName: owner.name,
      personType: (owner.person_type as 'singular' | 'coletiva') ?? 'singular',
      items,
      satisfiedCount,
      requiredCount,
    })
  }

  const propertySatisfiedCount = propItems.filter(
    (i) => i.status === 'satisfied'
  ).length
  const propertyRequiredCount = propItems.filter((i) => i.status !== 'na').length

  const totalSatisfied =
    propertySatisfiedCount + owners.reduce((n, o) => n + o.satisfiedCount, 0)
  const totalRequired =
    propertyRequiredCount + owners.reduce((n, o) => n + o.requiredCount, 0)

  return {
    property: propItems,
    propertySatisfiedCount,
    propertyRequiredCount,
    owners,
    totalSatisfied,
    totalRequired,
  }
}
