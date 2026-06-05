export interface EmailSender {
  id: string
  name: string
  email: string
  display_name: string
  reply_to: string | null
  is_default: boolean
}

export interface WppInstance {
  id: string
  name: string
  phone: string
  connection_status: string
}

export interface AlertChannelsConfig {
  notification: boolean
  email: {
    enabled: boolean
    sender_id: string | null // null = usar default (is_default = true)
  }
  whatsapp: {
    enabled: boolean
    wpp_instance_id: string | null // obrigatório se enabled = true
  }
}

export interface AlertRecipientsConfig {
  type: 'role' | 'consultant' | 'assigned' | 'specific_users'
  roles?: string[] // quando type = 'role'
  user_ids?: string[] // quando type = 'specific_users'
}

export interface AlertEventConfig {
  enabled: boolean
  channels: AlertChannelsConfig
  recipients: AlertRecipientsConfig
  message_template?: string
}

export type AlertEventType = 'on_complete' | 'on_overdue' | 'on_unblock' | 'on_assign'

export interface AlertsConfig {
  on_complete?: AlertEventConfig
  on_overdue?: AlertEventConfig
  on_unblock?: AlertEventConfig
  on_assign?: AlertEventConfig
}

export interface AlertContext {
  procInstanceId: string
  entityType: 'proc_task' | 'proc_subtask'
  entityId: string
  eventType: AlertEventType
  title: string
  processRef: string
  triggeredBy: string
  assignedTo?: string | null
}
