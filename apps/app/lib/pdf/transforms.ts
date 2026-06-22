import { numberToWordsPt } from '@/lib/text/number-to-words-pt'

export interface TransformOption {
  value: string
  label: string
}

export const TRANSFORMS: TransformOption[] = [
  { value: '__none__', label: 'Nenhum' },
  { value: 'uppercase', label: 'MAIÚSCULAS' },
  { value: 'lowercase', label: 'minúsculas' },
  { value: 'date_pt', label: 'Data PT (DD/MM/AAAA)' },
  { value: 'currency_eur', label: 'Moeda EUR' },
  { value: 'number_words_pt', label: 'Número por extenso (PT)' },
  // Partes de uma data DD/MM/AAAA (ou ISO) — para datas divididas em 3 campos
  { value: 'date_part_day', label: 'Data → dia' },
  { value: 'date_part_month', label: 'Data → mês' },
  { value: 'date_part_year', label: 'Data → ano' },
  // Partes de um código postal "AAAA-BBB"
  { value: 'cp_prefix', label: 'Código postal → 4 dígitos' },
  { value: 'cp_suffix', label: 'Código postal → 3 dígitos' },
  // Qualidade do 2.º contratante a partir do business_type
  { value: 'qualidade_from_business', label: 'Qualidade (Proprietário/Senhorio…)' },
  // Checkboxes condicionais — devolvem "sim" (marca) ou "" (não marca).
  // Aplicar ao mesmo variable_key da fonte (ex.: business_type, has_mortgage).
  { value: 'checkbox_if_venda', label: '☑ se venda' },
  { value: 'checkbox_if_arrendamento', label: '☑ se arrendamento' },
  { value: 'checkbox_if_trespasse', label: '☑ se trespasse' },
  { value: 'checkbox_if_outros', label: '☑ se outro tipo' },
  { value: 'checkbox_if_true', label: '☑ se verdadeiro' },
  { value: 'checkbox_if_false', label: '☑ se falso' },
  { value: 'checkbox_if_percentage', label: '☑ se comissão %' },
  { value: 'checkbox_if_fixed', label: '☑ se comissão fixa' },
]

// Valores que a engine de preenchimento considera "marcado" numa checkbox.
const CHECKBOX_TRUE = 'sim'

/** Extrai [dia, mes, ano] de uma string "DD/MM/AAAA" ou ISO (AAAA-MM-DD…). */
function dateParts(value: string): [string, string, string] | null {
  const ddmmyyyy = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (ddmmyyyy) return [ddmmyyyy[1], ddmmyyyy[2], ddmmyyyy[3]]
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getFullYear()),
  ]
}

export function applyTransform(value: string, transform: string | null): string {
  if (!transform || !value) return value

  switch (transform) {
    case 'uppercase':
      return value.toUpperCase()
    case 'lowercase':
      return value.toLowerCase()
    case 'date_pt': {
      const d = new Date(value)
      if (isNaN(d.getTime())) return value
      return d.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    }
    case 'currency_eur': {
      const num = parseFloat(value)
      if (isNaN(num)) return value
      return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
      }).format(num)
    }
    case 'number_words_pt': {
      const cleaned = value.replace(/€/g, '').replace(/\s/g, '').trim()
      const integerPart = cleaned.split(',')[0].replace(/\./g, '')
      const digits = integerPart.replace(/[^\d-]/g, '')
      if (!digits) return value
      const num = parseInt(digits, 10)
      if (isNaN(num)) return value
      return numberToWordsPt(num)
    }

    // ── Partes de data (campos DD / MM / AAAA separados) ──────────────
    case 'date_part_day':
      return dateParts(value)?.[0] ?? value
    case 'date_part_month':
      return dateParts(value)?.[1] ?? value
    case 'date_part_year':
      return dateParts(value)?.[2] ?? value

    // ── Partes de código postal "AAAA-BBB" ───────────────────────────
    case 'cp_prefix':
      return value.split('-')[0]?.trim() ?? value
    case 'cp_suffix':
      return value.split('-')[1]?.trim() ?? ''

    // ── Qualidade do 2.º contratante a partir do business_type ───────
    case 'qualidade_from_business': {
      switch (value.toLowerCase().trim()) {
        case 'venda':
          return 'Proprietário'
        case 'arrendamento':
          return 'Senhorio'
        case 'trespasse':
          return 'Trespassante'
        default:
          return 'Outro'
      }
    }

    // ── Checkboxes condicionais (devolvem "sim" para marcar) ─────────
    case 'checkbox_if_venda':
      return value.toLowerCase().trim() === 'venda' ? CHECKBOX_TRUE : ''
    case 'checkbox_if_arrendamento':
      return value.toLowerCase().trim() === 'arrendamento' ? CHECKBOX_TRUE : ''
    case 'checkbox_if_trespasse':
      return value.toLowerCase().trim() === 'trespasse' ? CHECKBOX_TRUE : ''
    case 'checkbox_if_outros':
      return ['venda', 'arrendamento', 'trespasse'].includes(
        value.toLowerCase().trim()
      )
        ? ''
        : CHECKBOX_TRUE
    case 'checkbox_if_true':
      return ['true', '1', 'sim', 'yes', 'on'].includes(value.toLowerCase().trim())
        ? CHECKBOX_TRUE
        : ''
    case 'checkbox_if_false':
      return ['false', '0', 'nao', 'não', 'no'].includes(value.toLowerCase().trim())
        ? CHECKBOX_TRUE
        : ''
    case 'checkbox_if_percentage':
      return value.toLowerCase().includes('percent') ? CHECKBOX_TRUE : ''
    case 'checkbox_if_fixed':
      return value.toLowerCase().includes('fix') ? CHECKBOX_TRUE : ''

    default:
      return value
  }
}
