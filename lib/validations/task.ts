import { z } from 'zod'

// ─── Create Task ─────────────────────────────────────────────
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').trim(),
  description: z.string().trim().optional().nullable(),
  parent_task_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  priority: z.number().int().min(1).max(4).default(4),
  due_date: z.string().optional().nullable(), // ISO string
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.string().optional().nullable(),
  entity_type: z.enum(['property', 'lead', 'process', 'owner', 'negocio']).optional().nullable(),
  entity_id: z.string().uuid().optional().nullable(),
})

// ─── Update Task ─────────────────────────────────────────────
export const updateTaskSchema = z.object({
  title: z.string().min(1).trim().optional(),
  description: z.string().trim().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  priority: z.number().int().min(1).max(4).optional(),
  due_date: z.string().optional().nullable(),
  is_recurring: z.boolean().optional(),
  recurrence_rule: z.string().optional().nullable(),
  is_completed: z.boolean().optional(),
  entity_type: z.enum(['property', 'lead', 'process', 'owner', 'negocio']).optional().nullable(),
  entity_id: z.string().uuid().optional().nullable(),
  order_index: z.number().int().optional(),
})

// ─── Create Comment ──────────────────────────────────────────
export const createTaskCommentSchema = z.object({
  content: z.string().min(1, 'Comentário é obrigatório').trim(),
})

// ─── Query Filters ───────────────────────────────────────────
export const taskQuerySchema = z.object({
  assigned_to: z.string().uuid().optional(),
  created_by: z.string().uuid().optional(),
  priority: z.coerce.number().int().min(1).max(4).optional(),
  is_completed: z.enum(['true', 'false']).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  entity_type: z.enum(['property', 'lead', 'process', 'owner', 'negocio']).optional(),
  entity_id: z.string().uuid().optional(),
  parent_task_id: z.string().uuid().optional(),
  search: z.string().optional(),
  // Source filter para o split em tabs:
  // - 'personal' = tasks (todoist-style) + visit_proposal (não inclui processos)
  // - 'process'  = só proc_task + proc_subtask
  // - undefined  = todas (back-compat)
  source_filter: z.enum(['personal', 'process']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
