import {
  PROPERTY_TYPES, BUSINESS_TYPES, PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES, CONTRACT_REGIMES,
  MARITAL_STATUS,
} from '@/lib/constants'

// String array constants
import {
  TYPOLOGIES, SOLAR_ORIENTATIONS, VIEWS,
  EQUIPMENT, FEATURES,
} from '@/lib/constants'

type ConstantMap = Record<string, readonly string[] | Readonly<Record<string, string>>>

const CONSTANT_MAP: ConstantMap = {
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES,
  CONTRACT_REGIMES,
  TYPOLOGIES,
  SOLAR_ORIENTATIONS,
  VIEWS,
  EQUIPMENT,
  FEATURES,
  MARITAL_STATUS,
}

export function resolveOptionsFromConstant(
  constantName?: string
): { value: string; label: string }[] {
  if (!constantName) return []
  const constant = CONSTANT_MAP[constantName]
  if (!constant) return []

  // String array (e.g. TYPOLOGIES, VIEWS, etc.)
  if (Array.isArray(constant)) {
    return (constant as readonly string[]).map(s => ({ value: s, label: s }))
  }

  // Object map (e.g. PROPERTY_TYPES: { apartamento: 'Apartamento' })
  return Object.entries(constant as Record<string, string>).map(([key, label]) => ({
    value: key,
    label,
  }))
}
