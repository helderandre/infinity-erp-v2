import { z } from 'zod'

export const AI_JOB_TYPES = ['image_stage', 'image_enhance', 'planta_3d', 'video_compress'] as const
export type AiJobType = (typeof AI_JOB_TYPES)[number]

export const AI_JOB_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number]

/** Payload schemas por tipo. O servidor valida o shape antes de enfileirar. */
const imageStagePayload = z.object({
  media_ids: z.array(z.string().uuid()).min(1).max(50),
  style: z.string().min(1).max(50),
  custom_prompt: z.string().max(500).optional(),
})

const imageEnhancePayload = z.object({
  media_ids: z.array(z.string().uuid()).min(1).max(50),
})

const planta3dPayload = z.object({
  planta_id: z.string().uuid(),
  variants: z.union([z.literal(1), z.literal(2)]).default(1),
  notes: z.string().max(300).optional(),
})

const videoCompressPayload = z.object({
  media_id: z.string().uuid(),
})

export const createJobSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('image_stage'), property_id: z.string().uuid(), payload: imageStagePayload }),
  z.object({ type: z.literal('image_enhance'), property_id: z.string().uuid(), payload: imageEnhancePayload }),
  z.object({ type: z.literal('planta_3d'), property_id: z.string().uuid(), payload: planta3dPayload }),
  z.object({ type: z.literal('video_compress'), property_id: z.string().uuid(), payload: videoCompressPayload }),
])

export type CreateJobInput = z.infer<typeof createJobSchema>
