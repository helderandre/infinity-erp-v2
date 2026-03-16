import { z } from 'zod'

const UUID_REGEX = /^[0-9a-f-]{36}$/

export const createVisitSchema = z.object({
  property_id: z.string().regex(UUID_REGEX, 'Imóvel é obrigatório'),
  consultant_id: z.string().regex(UUID_REGEX, 'Consultor é obrigatório'),
  lead_id: z.string().regex(UUID_REGEX).optional().nullable(),
  visit_date: z.string().min(1, 'Data é obrigatória'),
  visit_time: z.string().min(1, 'Hora é obrigatória'),
  duration_minutes: z.number().int().min(15).max(480).default(30),
  client_name: z.string().max(200).optional().nullable(),
  client_phone: z.string().max(30).optional().nullable(),
  client_email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  notes: z.string().max(2000).optional().nullable(),
}).refine(
  (data) => data.lead_id || data.client_name,
  { message: 'É necessário seleccionar um lead ou preencher o nome do cliente', path: ['lead_id'] }
)

export const updateVisitSchema = z.object({
  property_id: z.string().regex(UUID_REGEX).optional(),
  consultant_id: z.string().regex(UUID_REGEX).optional(),
  lead_id: z.string().regex(UUID_REGEX).optional().nullable(),
  visit_date: z.string().optional(),
  visit_time: z.string().optional(),
  duration_minutes: z.number().int().min(15).max(480).optional(),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  confirmed_by: z.string().optional().nullable(),
  confirmation_method: z.enum(['whatsapp', 'phone', 'email', 'sms']).optional().nullable(),
  client_name: z.string().max(200).optional().nullable(),
  client_phone: z.string().max(30).optional().nullable(),
  client_email: z.string().email().optional().nullable().or(z.literal('')),
  notes: z.string().max(2000).optional().nullable(),
})

export const visitFeedbackSchema = z.object({
  feedback_rating: z.number().int().min(1, 'Avaliação é obrigatória').max(5),
  feedback_interest: z.enum(['very_interested', 'interested', 'neutral', 'not_interested'], {
    message: 'Nível de interesse é obrigatório',
  }),
  feedback_notes: z.string().max(2000).optional().nullable(),
  feedback_next_step: z.enum(['second_visit', 'proposal', 'discard', 'thinking'], {
    message: 'Próximo passo é obrigatório',
  }),
})

export const cancelVisitSchema = z.object({
  cancelled_reason: z.string().min(1, 'Motivo de cancelamento é obrigatório').max(500),
})

export type CreateVisitInput = z.infer<typeof createVisitSchema>
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>
export type VisitFeedbackFormData = z.infer<typeof visitFeedbackSchema>
export type CancelVisitInput = z.infer<typeof cancelVisitSchema>
