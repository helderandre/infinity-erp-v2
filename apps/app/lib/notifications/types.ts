export type NotificationType =
  | 'process_created'
  | 'process_approved'
  | 'process_rejected'
  | 'process_returned'
  | 'process_deleted'
  | 'task_assigned'
  | 'task_completed'
  | 'task_comment'
  | 'chat_message'
  | 'comment_mention'
  | 'chat_mention'
  | 'task_updated'
  | 'task_overdue'
  | 'subtask_completed'
  | 'subtask_overdue'
  | 'subtask_unblocked'
  | 'subtask_assigned'
  | 'alert_on_complete'
  | 'alert_on_overdue'
  | 'alert_on_unblock'
  | 'alert_on_assign'
  | 'calendar_reminder'
  | 'internal_chat_message'
  | 'internal_chat_mention'
  | 'dm_message'
  | 'visit_proposal_created'
  | 'visit_proposal_confirmed'
  | 'visit_proposal_rejected'
  | 'owner_doc_submitted'
  | 'owner_cmi_signed'
  | 'owner_field_edited'
  | 'meta_sync_completed'
  | 'meta_sync_failed'
  | 'event_rsvp_responded'
  | 'encomenda_at_store'

export type NotificationEntityType =
  | 'proc_instance'
  | 'proc_task'
  | 'proc_task_comment'
  | 'proc_chat_message'
  | 'internal_chat_message'
  | 'task'
  | 'task_comment'
  | 'lead'
  | 'visit'
  | 'deal'
  | 'meta_sync'
  | 'calendar_event'
  | 'supplier_order'

export const PROCESS_NOTIFICATION_TYPES = [
  'comment_mention',
  'chat_mention',
  'chat_message',
  'task_comment',
] as const

export type ProcessNotificationType = (typeof PROCESS_NOTIFICATION_TYPES)[number]

export type NotificationBucket = 'processo' | 'geral'

export function classifyBucket(
  notificationType: string | null | undefined,
): NotificationBucket {
  return PROCESS_NOTIFICATION_TYPES.includes(notificationType as ProcessNotificationType)
    ? 'processo'
    : 'geral'
}

export interface CreateNotificationParams {
  recipientId: string
  senderId?: string | null
  notificationType: NotificationType
  entityType: NotificationEntityType
  entityId: string
  title: string
  body?: string
  actionUrl: string
  metadata?: Record<string, unknown>
}

export interface Notification {
  id: string
  recipient_id: string
  sender_id: string | null
  notification_type: NotificationType
  entity_type: NotificationEntityType
  entity_id: string
  title: string
  body: string | null
  action_url: string
  is_read: boolean
  read_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  // Via join
  sender?: {
    id: string
    commercial_name: string
    profile?: { profile_photo_url: string | null } | null
  }
}
