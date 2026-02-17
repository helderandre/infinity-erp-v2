import { z } from 'zod'

export const leadSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone_primary: z.string().optional(),
  phone_secondary: z.string().optional(),
  language: z.string().default('PT'),
  source: z.string().min(1, 'Seleccione a origem do lead'),
  source_detail: z.string().optional(),
  source_message: z.string().optional(),
  lead_type: z.string().default('unknown'),
  status: z.string().default('new'),
  business_type: z.string().optional(),
  priority: z.string().default('medium'),
  score: z.number().int().min(0).max(100).optional(),
  assigned_agent_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  property_reference: z.string().optional(),
  archived_reason: z.string().optional(),
})

export const leadActivitySchema = z.object({
  lead_id: z.string().uuid(),
  agent_id: z.string().uuid().optional(),
  activity_type: z.string().min(1, 'Seleccione o tipo de actividade'),
  description: z.string().optional(),
  metadata: z.any().optional(),
})

export type LeadFormData = z.infer<typeof leadSchema>
export type LeadActivityFormData = z.infer<typeof leadActivitySchema>
