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

export type NotificationEntityType =
  | 'proc_instance'
  | 'proc_task'
  | 'proc_task_comment'
  | 'proc_chat_message'

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
