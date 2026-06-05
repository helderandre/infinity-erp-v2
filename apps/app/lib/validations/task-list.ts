import { z } from 'zod'

const COLORS = ['neutral', 'red', 'orange', 'amber', 'emerald', 'blue', 'violet', 'pink'] as const

export const createTaskListSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(80).trim(),
  color: z.enum(COLORS).default('neutral'),
})

export const updateTaskListSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  color: z.enum(COLORS).optional(),
})

export const addMemberSchema = z.object({
  user_id: z.string().uuid(),
})
