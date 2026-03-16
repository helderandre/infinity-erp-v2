import { z } from 'zod'

const UUID_REGEX = /^[0-9a-f-]{36}$/

export const calendarEventSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200, 'Título demasiado longo'),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(['birthday', 'vacation', 'company_event', 'marketing_event', 'meeting', 'reminder', 'custom']),
  start_date: z.string().min(1, 'Data de início é obrigatória'),
  end_date: z.string().optional().nullable(),
  all_day: z.boolean().default(false),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.enum(['yearly', 'monthly', 'weekly']).optional().nullable(),
  user_id: z.string().regex(UUID_REGEX).optional().nullable(),
  property_id: z.string().regex(UUID_REGEX).optional().nullable(),
  lead_id: z.string().regex(UUID_REGEX).optional().nullable(),
  process_id: z.string().regex(UUID_REGEX).optional().nullable(),
  visibility: z.enum(['all', 'team', 'private']).default('all'),
  color: z.string().max(30).optional().nullable(),
})

export type CalendarEventFormData = z.infer<typeof calendarEventSchema>
