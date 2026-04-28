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
]

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
    default:
      return value
  }
}
