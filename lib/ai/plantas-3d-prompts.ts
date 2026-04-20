const PROMPT_FURNISHED = `Make this into a 3d render with furniture. White background.`

const PROMPT_DESIGNED = `Make this into a 3d render with modern interior design and furniture. White background.`

export const PLANTA_3D_VARIANT_PROMPTS = [
  PROMPT_FURNISHED,
  PROMPT_DESIGNED,
] as const

export function buildPlanta3DPrompt(notes?: string): string {
  return notes?.trim()
    ? `${PROMPT_FURNISHED}\n\n${notes.trim()}`
    : PROMPT_FURNISHED
}

export function buildPlanta3DVariantPrompts(notes?: string): string[] {
  const trimmed = notes?.trim()
  return PLANTA_3D_VARIANT_PROMPTS.map((p) =>
    trimmed ? `${p}\n\n${trimmed}` : p
  )
}
