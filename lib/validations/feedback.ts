import { z } from 'zod'
import { FEEDBACK_PAGES } from '@/types/feedback'

const FEEDBACK_PAGE_ENUM = FEEDBACK_PAGES.map((p) => p.slug) as [string, ...string[]]

export const createFeedbackSchema = z.object({
  type: z.enum(['ticket', 'ideia']),
  title: z.string().min(1, 'Título é obrigatório').trim(),
  description: z.string().trim().optional().nullable(),
  voice_url: z.string().url().optional().nullable(),
  images: z.array(z.string().url()).optional().default([]),
  page: z.enum(FEEDBACK_PAGE_ENUM),
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
  page: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
