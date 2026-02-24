import { z } from 'zod'

export const notificationUpdateSchema = z.object({
  is_read: z.boolean(),
})

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread_only: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
  type: z.string().optional(),
})

export type NotificationUpdateFormData = z.infer<typeof notificationUpdateSchema>
