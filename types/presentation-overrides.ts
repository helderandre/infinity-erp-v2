export interface PresentationOverrides {
  cover?: {
    title?: string | null
    eyebrow?: string | null
    cover_media_id?: string | null
  }
  resumo?: {
    title?: string | null
  }
  descricao?: {
    heading?: string | null
    body?: string | null
  }
  galeria?: {
    heading?: string | null
    media_ids?: string[] | null
  }
  localizacao?: {
    heading?: string | null
  }
  consultor?: {
    tagline?: string | null
  }
  closing?: {
    headline?: string | null
    eyebrow?: string | null
  }
}

export const PRESENTATION_OVERRIDE_SECTIONS = [
  'cover',
  'resumo',
  'descricao',
  'galeria',
  'localizacao',
  'consultor',
  'closing',
] as const

export type PresentationOverrideSection = (typeof PRESENTATION_OVERRIDE_SECTIONS)[number]

const trim = (v: unknown): string | null => {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length > 0 ? s : null
}

export const ov = {
  text: (v: unknown, fallback: string | null | undefined): string | null => {
    const t = trim(v)
    if (t !== null) return t
    return fallback ?? null
  },
}
