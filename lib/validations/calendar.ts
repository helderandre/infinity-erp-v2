import { z } from 'zod'

const UUID_REGEX = /^[0-9a-f-]{36}$/

/** Transform empty strings to null */
const emptyToNull = z.string().transform((v) => v === '' ? null : v).nullable().optional()
const urlOrEmpty = z.union([
  z.string().url('URL inválido'),
  z.literal(''),
]).transform((v) => v === '' ? null : v).nullable().optional()

export const calendarEventSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200, 'Título demasiado longo'),
  description: emptyToNull,
  category: z.enum(['birthday', 'vacation', 'company_event', 'marketing_event', 'meeting', 'reminder', 'custom']),
  item_type: z.enum(['event', 'task']).default('event'),
  start_date: z.string().min(1, 'Data de início é obrigatória'),
  end_date: emptyToNull,
  all_day: z.boolean().default(false),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.enum(['yearly', 'monthly', 'weekly']).optional().nullable().transform((v) => v || null),
  user_id: z.string().regex(UUID_REGEX).optional().nullable().or(z.literal('')).transform((v) => v === '' ? null : v || null),
  property_id: z.string().regex(UUID_REGEX).optional().nullable().or(z.literal('')).transform((v) => v === '' ? null : v || null),
  lead_id: z.string().regex(UUID_REGEX).optional().nullable().or(z.literal('')).transform((v) => v === '' ? null : v || null),
  visibility: z.enum(['all', 'team', 'private']).default('all'),
  visibility_mode: z.enum(['all', 'include', 'exclude']).default('all'),
  visibility_user_ids: z.array(z.string().regex(UUID_REGEX)).default([]),
  visibility_role_names: z.array(z.string()).default([]),
  color: emptyToNull,
  cover_image_url: emptyToNull,
  location: emptyToNull,
  requires_rsvp: z.boolean().default(false),
  livestream_url: urlOrEmpty,
  registration_url: urlOrEmpty,
  links: z.array(z.object({
    name: z.string().min(1).max(100),
    url: z.string().url('URL inválido'),
  })).default([]),
  reminders: z.array(z.object({
    minutes_before: z.number().min(0),
  })).default([]),
  // Task-only: priority 1=Urgente … 4=Normal. Default 4.
  priority: z.number().int().min(1).max(4).default(4),
})

export type CalendarEventFormData = z.infer<typeof calendarEventSchema>

// Schema para o modal de agendar evento (subtarefa schedule_event)
export const scheduleEventSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200, 'Título demasiado longo'),
  description: z.string().max(2000).optional().nullable(),
  start_date: z.string().min(1, 'Data de início é obrigatória'),
  end_date: z.string().optional().nullable(),
  all_day: z.boolean().default(true),
  owner_ids: z.array(z.string().regex(UUID_REGEX)).default([]),
  attendee_user_ids: z.array(z.string().regex(UUID_REGEX)).default([]),
})

export type ScheduleEventFormData = z.infer<typeof scheduleEventSchema>
