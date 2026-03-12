import type { Database } from './database'
import type { ProcSubtask } from './subtask'

export type ProcessType = 'angariacao' | 'negocio'

type ProcInstance = Database['public']['Tables']['proc_instances']['Row']
type ProcTask = Database['public']['Tables']['proc_tasks']['Row']
type DevProperty = Database['public']['Tables']['dev_properties']['Row']
type DevUser = Database['public']['Tables']['dev_users']['Row']

export interface PropertySpecs {
  typology: string | null
  bedrooms: number | null
  bathrooms: number | null
  area_gross: number | null
  area_util: number | null
  construction_year: number | null
  parking_spaces: number | null
  garage_spaces: number | null
  features: string[] | null
  has_elevator: boolean | null
  fronts_count: number | null
  solar_orientation: string[] | null
  views: string[] | null
  equipment: string[] | null
}

export interface PropertyInternal {
  commission_agreed: number | null
  commission_type: string | null
  contract_regime: string | null
  contract_term: string | null
  contract_expiry: string | null
  imi_value: number | null
  condominium_fee: number | null
}

export interface ProcessInstance extends ProcInstance {
  process_type: ProcessType
  property?: Pick<
    DevProperty,
    | 'id' | 'title' | 'slug' | 'city' | 'listing_price' | 'status' | 'property_type'
    | 'business_type' | 'property_condition' | 'energy_certificate'
    | 'external_ref' | 'description'
    | 'address_street' | 'postal_code' | 'zone'
    | 'latitude' | 'longitude'
  > & {
    specs?: PropertySpecs | null
    internal?: PropertyInternal | null
    cover_url?: string | null
    media?: Array<{
      id: string
      url: string
      media_type: string
      is_cover: boolean
      order_index: number
    }>
  }
  requested_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
  approved_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
  returned_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
  rejected_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
}

export interface ProcessTask extends ProcTask {
  assigned_to_user?: Pick<DevUser, 'id' | 'commercial_name'> & { profile_photo_url?: string | null }
  owner?: {
    id: string
    name: string
    person_type: 'singular' | 'coletiva'
  } | null
  priority: TaskPriority
  subtasks?: ProcSubtask[]
  // Nome da dependência (resolvido pelo servidor)
  blocking_task_title?: string | null
}

export interface ProcessStageWithTasks {
  name: string
  order_index: number
  status: 'completed' | 'in_progress' | 'pending'
  tasks_completed: number
  tasks_total: number
  tasks: ProcessTask[]
}

export interface ProcessOwner {
  id: string
  name: string
  email: string | null
  phone: string | null
  nif: string | null
  person_type: 'singular' | 'coletiva'
  ownership_percentage: number
  is_main_contact: boolean
}

export interface ProcessDocument {
  id: string
  doc_type: { id: string; name: string; category: string }
  doc_type_id: string | null
  owner_id: string | null
  file_name: string
  file_url: string
  status: string
  valid_until: string | null
  created_at: string
}

// ── Gestor de Documentos (pastas) ──

export interface DocumentFile {
  id: string
  file_name: string
  file_url: string
  doc_type: {
    id: string
    name: string
    category: string
  }
  status: 'active' | 'archived' | 'expired'
  uploaded_by?: {
    id: string
    commercial_name: string
  }
  metadata: {
    size?: number
    mimetype?: string
    r2_key?: string
  }
  valid_until?: string
  notes?: string
  created_at: string
  source?: 'registry' | 'task'
  task_title?: string
}

export interface DocumentFolder {
  id: string
  name: string
  icon: string
  type: 'property' | 'process' | 'owner' | 'consultant' | 'media'
  entity_id?: string
  document_count: number
  documents: DocumentFile[]
}

export interface ProcessDocumentsResponse {
  folders: DocumentFolder[]
  stats: {
    total_documents: number
    total_size_bytes: number
    by_status: Record<string, number>
  }
}

export interface ProcessDetail {
  instance: ProcessInstance
  stages: ProcessStageWithTasks[] | null
  owners: ProcessOwner[]
  documents: ProcessDocument[]
}

export type ProcessStatus =
  | 'pending_approval'
  | 'returned'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

export type TaskPriority = 'urgent' | 'normal' | 'low'

export type TaskAction =
  | 'complete'
  | 'bypass'
  | 'assign'
  | 'start'
  | 'reset'
  | 'update_priority'
  | 'update_due_date'

export type ActionType = 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL' | 'FORM' | 'COMPOSITE'

// ── Comentários de tarefa ──

export interface TaskComment {
  id: string
  proc_task_id: string
  user_id: string
  content: string // Texto com marcadores: @[Nome](user-id)
  mentions: TaskCommentMention[]
  created_at: string
  updated_at: string
  user?: {
    id: string
    commercial_name: string
    profile?: { profile_photo_url: string | null } | null
  }
}

export interface TaskCommentMention {
  user_id: string
  display_name: string
}

export interface TaskActivityEntry {
  id: string
  type: 'comment' | 'status_change' | 'assignment' | 'priority_change' | 'due_date_change' | 'bypass'
  user_id: string
  user_name: string
  content: string
  metadata?: Record<string, unknown>
  created_at: string
}

// ── Actividades de Tarefa (nova tabela proc_task_activities) ──

export type TaskActivityType =
  | 'status_change'
  | 'assignment'
  | 'priority_change'
  | 'due_date_change'
  | 'bypass'
  | 'upload'
  | 'email_sent'
  | 'doc_generated'
  | 'started'
  | 'completed'
  | 'viewed'
  | 'draft_generated'
  | 'comment'
  | 'email_delivered'
  | 'email_opened'
  | 'email_clicked'
  | 'email_bounced'
  | 'email_failed'
  | 'email_resent'
  | 'email_delayed'
  | 'subtask_reverted'
  | 'document_replaced'
  | 'upload_completed'
  | 'task_created'
  | 'task_deleted'
  | 'subtask_added'
  | 'subtask_deleted'
  | 'adhoc_task_completed'
  | 'adhoc_subtask_completed'
  | 'adhoc_subtask_reverted'

export interface TaskActivity {
  id: string
  proc_task_id: string
  user_id: string | null
  activity_type: TaskActivityType
  description: string
  metadata?: Record<string, unknown>
  created_at: string
  user?: {
    id: string
    commercial_name: string
    profile?: { profile_photo_url: string | null } | null
  } | null
}

// ── Chat de Processo ──

export interface ChatMessage {
  id: string
  proc_instance_id: string
  sender_id: string
  content: string
  parent_message_id: string | null
  mentions: ChatMention[]
  has_attachments: boolean
  is_deleted: boolean
  deleted_at: string | null
  is_edited: boolean
  edited_at: string | null
  created_at: string
  updated_at: string
  // Joins
  sender?: {
    id: string
    commercial_name: string
    profile?: { profile_photo_url: string | null } | null
  }
  parent_message?: {
    id: string
    content: string
    sender_id: string
    sender?: { id: string; commercial_name: string }
  } | null
  attachments?: ChatAttachment[]
  reactions?: ChatReaction[]
}

export interface ChatMention {
  user_id: string
  display_name: string
}

/** Entity mentions (tasks, subtasks, docs) — parsed from content at render time */
export interface ChatEntityMention {
  entity_type: 'task' | 'subtask' | 'doc'
  entity_id: string
  display_name: string
}

export interface ChatReaction {
  id: string
  emoji: string
  user_id: string
  user?: { commercial_name: string } | null
}

export interface ChatAttachment {
  id: string
  message_id: string
  file_name: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  attachment_type: 'image' | 'document' | 'audio' | 'video' | 'file'
  storage_key: string
  uploaded_by: string
  created_at: string
}

export interface ChatPresenceUser {
  user_id: string
  user_name: string
  typing: boolean
  online_at: string
}

export interface ChatReadReceipt {
  proc_instance_id: string
  user_id: string
  last_read_message_id: string | null
  last_read_at: string
  user?: {
    id: string
    commercial_name: string
    profile?: { profile_photo_url: string | null } | null
  }
}

// ── Log de Emails ──

export interface LogEmail {
  id: string
  proc_task_id: string | null
  proc_subtask_id: string | null
  resend_email_id: string | null
  recipient_email: string
  sender_email: string | null
  sender_name: string | null
  cc: string[] | null
  subject: string | null
  body_html: string | null
  sent_at: string | null
  delivery_status: string | null
  last_event: string
  events: Array<{
    type: string
    timestamp: string
    metadata?: Record<string, unknown> | null
  }>
  parent_email_id: string | null
  error_message: string | null
  metadata: Record<string, unknown> | null
}

// ── Notificações ──

export type { Notification, NotificationType, NotificationEntityType } from '@/lib/notifications/types'
