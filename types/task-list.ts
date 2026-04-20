export type TaskListColor =
  | 'neutral' | 'red' | 'orange' | 'amber' | 'emerald' | 'blue' | 'violet' | 'pink'

export interface TaskList {
  id: string
  name: string
  color: TaskListColor
  owner_id: string
  created_at: string
  updated_at: string
}

export interface TaskListMember {
  user_id: string
  commercial_name: string
  profile_photo_url?: string | null
  added_at: string
}

export interface TaskListWithMeta extends TaskList {
  is_owner: boolean
  member_count: number
  pending_count: number
  members?: TaskListMember[]
  owner?: { id: string; commercial_name: string; profile_photo_url?: string | null } | null
}

// UI color palette for lists (matches DB check constraint)
export const TASK_LIST_COLORS: Record<TaskListColor, { label: string; hash: string }> = {
  neutral: { label: 'Neutro', hash: 'text-muted-foreground' },
  red: { label: 'Vermelho', hash: 'text-red-500' },
  orange: { label: 'Laranja', hash: 'text-orange-500' },
  amber: { label: 'Âmbar', hash: 'text-amber-500' },
  emerald: { label: 'Verde', hash: 'text-emerald-500' },
  blue: { label: 'Azul', hash: 'text-blue-500' },
  violet: { label: 'Violeta', hash: 'text-violet-500' },
  pink: { label: 'Rosa', hash: 'text-pink-500' },
}
