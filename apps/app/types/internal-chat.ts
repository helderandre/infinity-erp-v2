export interface InternalChatMessage {
  id: string
  channel_id: string
  sender_id: string
  content: string
  parent_message_id: string | null
  mentions: InternalChatMention[]
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
  attachments?: InternalChatAttachment[]
  reactions?: InternalChatReaction[]
}

export interface InternalChatMention {
  user_id: string
  display_name: string
}

export interface InternalChatAttachment {
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

export interface InternalChatReaction {
  id: string
  emoji: string
  user_id: string
  user?: { commercial_name: string } | null
}

export interface InternalChatReadReceipt {
  channel_id: string
  user_id: string
  last_read_message_id: string | null
  last_read_at: string
  user?: {
    id: string
    commercial_name: string
    profile?: { profile_photo_url: string | null } | null
  }
}

export interface ProcessChannelPreview {
  proc_instance_id: string
  external_ref: string
  property_title: string | null
  current_status: string
  last_message: {
    content: string
    sender_name: string
    created_at: string
  } | null
  unread_count: number
}
