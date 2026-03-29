// ─── Task Types ──────────────────────────────────────────────

export interface Task {
  id: string
  title: string
  description: string | null
  parent_task_id: string | null
  assigned_to: string | null
  created_by: string | null
  priority: number // 1=urgente, 2=alta, 3=média, 4=normal
  due_date: string | null
  is_recurring: boolean
  recurrence_rule: string | null
  is_completed: boolean
  completed_at: string | null
  completed_by: string | null
  entity_type: TaskEntityType | null
  entity_id: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export type TaskEntityType = 'property' | 'lead' | 'process' | 'owner' | 'negocio'

export type TaskPriority = 1 | 2 | 3 | 4

// ─── Task with Relations ─────────────────────────────────────

export interface TaskWithRelations extends Task {
  assignee?: { id: string; commercial_name: string } | null
  creator?: { id: string; commercial_name: string } | null
  sub_tasks?: Task[]
  _comment_count?: number
  _attachment_count?: number
  _entity_label?: string
}

// ─── Task Comment ────────────────────────────────────────────

export interface TaskComment {
  id: string
  task_id: string
  user_id: string | null
  content: string
  created_at: string
  user?: { id: string; commercial_name: string } | null
}

// ─── Task Attachment ─────────────────────────────────────────

export interface TaskAttachment {
  id: string
  task_id: string
  uploaded_by: string | null
  file_name: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  created_at: string
  uploader?: { id: string; commercial_name: string } | null
}

// ─── Priority Labels & Colors ────────────────────────────────

export const TASK_PRIORITY_MAP = {
  1: { label: 'Urgente', color: 'text-red-600', bg: 'bg-red-100', dot: 'bg-red-500' },
  2: { label: 'Alta', color: 'text-orange-600', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  3: { label: 'Média', color: 'text-blue-600', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  4: { label: 'Normal', color: 'text-slate-500', bg: 'bg-slate-100', dot: 'bg-slate-400' },
} as const

export const TASK_ENTITY_LABELS: Record<TaskEntityType, string> = {
  property: 'Imóvel',
  lead: 'Lead',
  process: 'Processo',
  owner: 'Proprietário',
  negocio: 'Negócio',
}

// ─── Recurrence Presets ──────────────────────────────────────

export const RECURRENCE_PRESETS = [
  { label: 'Diariamente', rule: 'FREQ=DAILY' },
  { label: 'Dias úteis', rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Semanalmente', rule: 'FREQ=WEEKLY' },
  { label: 'Quinzenalmente', rule: 'FREQ=WEEKLY;INTERVAL=2' },
  { label: 'Mensalmente', rule: 'FREQ=MONTHLY' },
  { label: 'Trimestralmente', rule: 'FREQ=MONTHLY;INTERVAL=3' },
  { label: 'Anualmente', rule: 'FREQ=YEARLY' },
] as const
