import { z } from 'zod'

export const activitySchema = z.object({
  activity_type: z.enum([
    'status_change', 'assignment', 'priority_change', 'due_date_change',
    'bypass', 'upload', 'email_sent', 'doc_generated', 'started',
    'completed', 'viewed', 'draft_generated', 'comment',
    'email_delivered', 'email_opened', 'email_clicked',
    'email_bounced', 'email_failed', 'email_resent',
    'subtask_reverted', 'document_replaced', 'upload_completed',
  ]),
  description: z.string().min(1).max(1000),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type ActivityFormData = z.infer<typeof activitySchema>
