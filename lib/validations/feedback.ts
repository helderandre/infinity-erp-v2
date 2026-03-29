import { z } from 'zod'

export const createFeedbackSchema = z.object({
  type: z.enum(['ticket', 'ideia']),
  title: z.string().min(1, 'Título é obrigatório').trim(),
  description: z.string().trim().optional().nullable(),
  voice_url: z.string().url().optional().nullable(),
  images: z.array(z.string().url()).optional().default([]),
})

export const updateFeedbackSchema = z.object({
  status: z.enum(['novo', 'em_analise', 'em_desenvolvimento', 'concluido', 'rejeitado']).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  tech_notes: z.string().trim().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  title: z.string().min(1).trim().optional(),
  description: z.string().trim().optional().nullable(),
})

export const feedbackQuerySchema = z.object({
  type: z.enum(['ticket', 'ideia']).optional(),
  status: z.string().optional(),
  submitted_by: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
