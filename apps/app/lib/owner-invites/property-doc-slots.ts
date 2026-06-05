import type { OwnerDocSlot } from './doc-slots'

// Property-level doc slots — match the 6 file uploads of the angariação
// "Documentos do Imóvel" subtask group. The 7th subtask (Hipoteca) is a
// yes/no field, not a file, so it stays out of this list.

export const PROPERTY_DOC_SLOTS: OwnerDocSlot[] = [
  {
    slug: 'caderneta-predial',
    label: 'Caderneta Predial',
    description: 'Documento das Finanças com a inscrição do imóvel',
    required: true,
    aliases: ['caderneta', 'predial', 'inscricao matricial', 'finanças'],
  },
  {
    slug: 'certidao-permanente-predial',
    label: 'Certidão Permanente do Imóvel',
    description: 'Certidão da Conservatória do Registo Predial',
    required: true,
    aliases: [
      'certidao permanente',
      'registo predial',
      'conservatoria',
      'predial',
    ],
  },
  {
    slug: 'certificado-energetico',
    label: 'Certificado Energético',
    required: true,
    aliases: ['ce', 'certificado energetico', 'desempenho energetico', 'adene'],
  },
  {
    slug: 'licenca-utilizacao',
    label: 'Licença de Utilização',
    description: 'Obrigatório para imóveis posteriores a 7 de Agosto de 1951',
    required: true,
    aliases: ['licenca de utilizacao', 'utilizacao', 'camara municipal'],
  },
  {
    slug: 'ficha-tecnica',
    label: 'Ficha Técnica de Habitação',
    description: 'Obrigatório para imóveis posteriores a Março de 2004',
    required: false,
    aliases: ['ficha tecnica', 'fth', 'ficha tecnica habitacao'],
  },
  {
    slug: 'planta',
    label: 'Planta do imóvel',
    required: false,
    aliases: ['planta', 'projecto', 'projeto'],
  },
]

export function findPropertySlot(slug: string): OwnerDocSlot | undefined {
  return PROPERTY_DOC_SLOTS.find((s) => s.slug === slug)
}

// Returns the doc_types whose name matches a property slot. Used both for
// uploads (to assign doc_type_id) and for status detection (to check if
// the consultant has already uploaded this doc-type via the regular UI).
// We match by trimmed lowercase ILIKE since doc_types names vary in casing.
export function slotToDocTypeNamePatterns(slug: string): string[] {
  const slot = findPropertySlot(slug)
  if (!slot) return []
  const patterns = [slot.label, ...(slot.aliases ?? [])]
  return patterns.map((p) => p.trim())
}
