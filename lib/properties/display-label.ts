import { PROPERTY_TYPES } from '@/lib/constants'

interface DisplayLabelInput {
  property_type?: string | null
  address_parish?: string | null
  city?: string | null
  zone?: string | null
  dev_property_specifications?: { typology?: string | null } | null
}

/**
 * Build the short display label for a property: "Apartamento T2, Alfragide".
 * Falls back gracefully when fields are missing (omits the missing piece
 * rather than rendering empty separators).
 */
export function buildPropertyDisplayLabel(p: DisplayLabelInput): string {
  const typeLabel =
    PROPERTY_TYPES[p.property_type as keyof typeof PROPERTY_TYPES] || p.property_type || ''
  const typology = p.dev_property_specifications?.typology?.trim() || ''
  const head = [typeLabel, typology].filter(Boolean).join(' ').trim()
  const place = (p.address_parish || p.zone || p.city || '').trim()
  if (head && place) return `${head}, ${place}`
  return head || place || 'Imóvel'
}
