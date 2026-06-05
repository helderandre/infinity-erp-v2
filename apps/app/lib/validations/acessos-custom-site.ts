import { z } from 'zod'

export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const urlField = z
  .string()
  .trim()
  .min(1, 'URL obrigatório')
  .transform(normalizeUrl)
  .refine((value) => {
    try {
      const u = new URL(value)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }, 'URL inválido')

export const createSiteSchema = z.object({
  title: z.string().trim().min(1, 'Título obrigatório').max(80, 'Máximo 80 caracteres'),
  url: urlField,
  scope: z.enum(['global', 'personal']).default('personal'),
  icon: z.string().trim().max(40).optional().nullable(),
  sort_order: z.number().int().optional(),
})

export const updateSiteSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  url: urlField.optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  sort_order: z.number().int().optional(),
})

export type CreateSiteInput = z.infer<typeof createSiteSchema>
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>
