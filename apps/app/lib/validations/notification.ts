import { z } from 'zod'

export const notificationUpdateSchema = z.object({
  is_read: z.boolean(),
})

export const markAllReadScopeSchema = z
  .object({
    notification_types: z.array(z.string().min(1)).min(1).optional(),
    exclude_notification_types: z.array(z.string().min(1)).min(1).optional(),
  })
  .refine((v) => !(v.notification_types && v.exclude_notification_types), {
    message: 'notification_types and exclude_notification_types are mutually exclusive',
  })

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread_only: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
  type: z.string().optional(),
})

export type NotificationUpdateFormData = z.infer<typeof notificationUpdateSchema>
