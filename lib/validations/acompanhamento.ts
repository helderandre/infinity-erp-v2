import { z } from 'zod'

const UUID_REGEX = /^[0-9a-f-]{36}$/

export const createAcompanhamentoSchema = z.object({
  negocio_id: z.string().regex(UUID_REGEX, 'Negócio é obrigatório'),
  lead_id: z.string().regex(UUID_REGEX, 'Lead é obrigatório'),
  consultant_id: z.string().regex(UUID_REGEX, 'Consultor é obrigatório'),

  // Credit (extra fields not in negócio)
  pre_approval_amount: z.number().min(0).optional().nullable(),
  credit_intermediation: z.boolean().default(false),
  credit_entity: z.string().max(200).optional().nullable(),
  credit_notes: z.string().max(2000).optional().nullable(),

  notes: z.string().max(5000).optional().nullable(),
})

export const updateAcompanhamentoSchema = z.object({
  status: z.enum(['active', 'paused', 'converted', 'lost']).optional(),
  lost_reason: z.string().max(500).optional().nullable(),
  pre_approval_amount: z.number().min(0).optional().nullable(),
  credit_intermediation: z.boolean().optional(),
  credit_entity: z.string().max(200).optional().nullable(),
  credit_notes: z.string().max(2000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

export const addPropertySchema = z.object({
  property_id: z.string().regex(UUID_REGEX).optional().nullable(),
  external_url: z.string().url('URL inválido').optional().nullable(),
  external_title: z.string().max(300).optional().nullable(),
  external_price: z.number().min(0).optional().nullable(),
  external_source: z.string().max(50).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
}).refine(
  (data) => data.property_id || data.external_url,
  { message: 'É necessário um imóvel do CRM ou um link externo', path: ['property_id'] }
)

export const updatePropertyStatusSchema = z.object({
  status: z.enum(['suggested', 'sent', 'visited', 'interested', 'discarded']),
  notes: z.string().max(500).optional().nullable(),
})

export type CreateAcompanhamentoInput = z.infer<typeof createAcompanhamentoSchema>
export type UpdateAcompanhamentoInput = z.infer<typeof updateAcompanhamentoSchema>
