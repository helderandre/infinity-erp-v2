import { z } from 'zod'
import { FUNNEL_STAGES } from '@/types/funnel-event'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const createFunnelEventSchema = z.object({
  side: z.enum(['vendedor', 'comprador']),
  stage: z.enum(FUNNEL_STAGES as [string, ...string[]]),
  occurred_at: z.string().datetime().optional(),
  count: z.number().int().positive().max(1000).default(1),
  source: z.string().min(1).max(64).default('manual'),
  source_ref_type: z.string().max(64).optional().nullable(),
  source_ref_id: z.string().regex(uuidRegex).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export type CreateFunnelEventInput = z.infer<typeof createFunnelEventSchema>
