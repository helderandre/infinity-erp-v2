// Doc slots required/optional for each owner-invite context.
// `slug` is also used as the R2 sub-folder and as the slot identifier sent
// between the public form and the submit handler.

export type OwnerInviteContext =
  | 'singular'
  | 'singular_heranca_cabeca'
  | 'singular_heranca_herdeiro'
  | 'coletiva'

export interface OwnerDocSlot {
  slug: string
  label: string
  description?: string
  required: boolean
  // Synonyms help the AI classifier map free-text filenames / OCR hints to
  // the canonical slot. Kept lowercase, accent-stripped comparisons elsewhere.
  aliases?: string[]
}

// Note: NIF is NOT a slot — it lives on the CC and is extracted from there.

const SLOTS_SINGULAR: OwnerDocSlot[] = [
  {
    slug: 'cc-passaporte',
    label: 'CC ou Passaporte',
    required: true,
    aliases: [
      'cartao de cidadao',
      'cartão de cidadão',
      'passport',
      'bilhete de identidade',
      'bi',
    ],
  },
  {
    slug: 'comprovativo-morada',
    label: 'Comprovativo de morada',
    description: 'Factura recente ou atestado de residência',
    required: true,
    aliases: [
      'atestado de residencia',
      'factura',
      'fatura',
      'agua',
      'luz',
      'edp',
      'galp',
    ],
  },
]

const SLOTS_HERANCA_CABECA: OwnerDocSlot[] = [
  {
    slug: 'cc-passaporte',
    label: 'CC ou Passaporte (cabeça de casal)',
    required: true,
    aliases: ['cartao de cidadao', 'passport', 'cc'],
  },
  {
    slug: 'habilitacao-herdeiros',
    label: 'Habilitação de herdeiros',
    required: true,
    aliases: ['habilitacao', 'herdeiros', 'escritura de habilitacao'],
  },
  {
    slug: 'certidao-obito',
    label: 'Certidão de óbito',
    required: true,
    aliases: ['obito', 'certidao de obito', 'morte'],
  },
  {
    slug: 'escritura-partilhas',
    label: 'Escritura de partilhas',
    description: 'Apenas se a partilha já tiver sido feita',
    required: false,
    aliases: ['partilhas', 'escritura'],
  },
]

const SLOTS_HERANCA_HERDEIRO: OwnerDocSlot[] = [
  {
    slug: 'cc-passaporte',
    label: 'CC ou Passaporte',
    required: true,
    aliases: ['cc', 'passport'],
  },
]

const SLOTS_COLETIVA: OwnerDocSlot[] = [
  {
    slug: 'certidao-permanente',
    label: 'Certidão permanente da empresa',
    required: true,
    aliases: ['certidao permanente', 'registo comercial'],
  },
  {
    slug: 'cc-rep-legal',
    label: 'CC ou Passaporte do representante legal',
    required: true,
    aliases: ['cartao de cidadao', 'representante legal', 'cc representante'],
  },
  {
    slug: 'ata-nomeacao',
    label: 'Ata de nomeação do representante',
    required: true,
    aliases: ['ata', 'nomeacao', 'acta'],
  },
  {
    slug: 'rcbe',
    label: 'RCBE — Beneficiário Efetivo',
    required: true,
    aliases: ['beneficiario efetivo', 'rcbe', 'registo central'],
  },
]

export const OWNER_DOC_SLOTS: Record<OwnerInviteContext, OwnerDocSlot[]> = {
  singular: SLOTS_SINGULAR,
  singular_heranca_cabeca: SLOTS_HERANCA_CABECA,
  singular_heranca_herdeiro: SLOTS_HERANCA_HERDEIRO,
  coletiva: SLOTS_COLETIVA,
}

export function getSlots(context: OwnerInviteContext): OwnerDocSlot[] {
  return OWNER_DOC_SLOTS[context]
}

export function findSlot(
  context: OwnerInviteContext,
  slug: string
): OwnerDocSlot | undefined {
  return OWNER_DOC_SLOTS[context].find((s) => s.slug === slug)
}
