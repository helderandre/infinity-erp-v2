import {
  PROPERTY_TYPES, BUSINESS_TYPES, PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES, CONTRACT_REGIMES,
  MARITAL_STATUS,
  PROPERTY_STATUS, PROCESS_STATUS, PROCESS_TYPES,
} from '@/lib/constants'

// String array constants
import {
  TYPOLOGIES, SOLAR_ORIENTATIONS, VIEWS,
  EQUIPMENT, FEATURES,
} from '@/lib/constants'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConstantMap = Record<string, any>

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
  PROPERTY_STATUS,
  PROCESS_STATUS,
  PROCESS_TYPES,
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

  // Object map — two formats:
  // 1. Simple: { apartamento: 'Apartamento' }
  // 2. With label: { active: { label: 'Activo', bg: '...', ... } }
  return Object.entries(constant as Record<string, unknown>).map(([key, val]) => {
    if (typeof val === 'string') {
      return { value: key, label: val }
    }
    if (val && typeof val === 'object' && 'label' in val) {
      return { value: key, label: (val as { label: string }).label }
    }
    return { value: key, label: key }
  })
}
