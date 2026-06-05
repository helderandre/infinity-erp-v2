import { z } from 'zod'

export const alertChannelsSchema = z.object({
  notification: z.boolean().default(false),
  email: z.object({
    enabled: z.boolean().default(false),
    sender_id: z.string().uuid().nullable().default(null),
  }).default({ enabled: false, sender_id: null }),
  whatsapp: z.object({
    enabled: z.boolean().default(false),
    wpp_instance_id: z.string().uuid().nullable().default(null),
  }).default({ enabled: false, wpp_instance_id: null }),
})

export const alertRecipientsSchema = z.object({
  type: z.enum(['role', 'consultant', 'assigned', 'specific_users']),
  roles: z.array(z.string()).optional(),
  user_ids: z.array(z.string().uuid()).optional(),
})

export const alertEventSchema = z.object({
  enabled: z.boolean().default(false),
  channels: alertChannelsSchema,
  recipients: alertRecipientsSchema,
  message_template: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.channels.whatsapp.enabled && !data.channels.whatsapp.wpp_instance_id) return false
    return true
  },
  { message: 'Seleccione uma instância WhatsApp', path: ['channels', 'whatsapp', 'wpp_instance_id'] }
)

export const alertsConfigSchema = z.object({
  on_complete: alertEventSchema.optional(),
  on_overdue: alertEventSchema.optional(),
  on_unblock: alertEventSchema.optional(),
  on_assign: alertEventSchema.optional(),
}).optional()
