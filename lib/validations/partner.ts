import { z } from 'zod'

const UUID_REGEX = /^[0-9a-f-]{36}$/

const CATEGORIES = [
  'lawyer', 'notary', 'bank', 'photographer', 'constructor',
  'insurance', 'energy_cert', 'cleaning', 'moving', 'appraiser',
  'architect', 'home_staging', 'credit_broker', 'interior_design',
  'marketing', 'other',
] as const

export const createPartnerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  person_type: z.enum(['singular', 'coletiva']).default('coletiva'),
  nif: z.string().max(20).optional().nullable().or(z.literal('')),
  category: z.enum(CATEGORIES, { message: 'Categoria é obrigatória' }),
  visibility: z.enum(['public', 'private']).default('public'),

  email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  phone: z.string().max(30).optional().nullable(),
  phone_secondary: z.string().max(30).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  postal_code: z.string().max(10).optional().nullable(),
  contact_person: z.string().max(200).optional().nullable(),

  specialties: z.array(z.string()).optional().nullable(),
  service_areas: z.array(z.string()).optional().nullable(),
  commercial_conditions: z.string().max(2000).optional().nullable(),
  payment_method: z.enum(['transfer', 'check', 'cash', 'other']).optional().nullable(),

  is_recommended: z.boolean().default(false),
  internal_notes: z.string().max(2000).optional().nullable(),
})

export const updatePartnerSchema = createPartnerSchema.partial()

export const ratePartnerSchema = z.object({
  rating: z.number().int().min(1, 'Avaliação é obrigatória').max(5),
  comment: z.string().max(500).optional().nullable(),
})

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>
export type RatePartnerInput = z.infer<typeof ratePartnerSchema>
