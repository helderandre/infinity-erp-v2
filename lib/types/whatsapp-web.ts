// ── WhatsApp Web Types ──

export type WppMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'reaction'
  | 'poll'
  | 'view_once'

export type WppMessageStatus =
  | 'sent'
  | 'delivered'
  | 'read'
  | 'played'
  | 'failed'

export interface WppReaction {
  emoji: string
  sender: string
  from_me: boolean
  timestamp: number
}

export interface WppMessage {
  id: string
  chat_id: string
  instance_id: string
  wa_message_id: string
  from_me: boolean
  sender_name: string | null
  sender_phone: string | null
  text: string | null
  message_type: WppMessageType
  status: WppMessageStatus | null
  timestamp: number
  media_url: string | null
  media_mime_type: string | null
  media_file_name: string | null
  media_file_size: number | null
  media_duration: number | null
  media_thumbnail_url: string | null
  quoted_message_id: string | null
  is_forwarded: boolean
  is_starred: boolean
  is_deleted: boolean
  is_edited: boolean
  reactions: WppReaction[] | null
  location_latitude: number | null
  location_longitude: number | null
  location_name: string | null
  contact_vcard: string | null
  poll_data: Record<string, unknown> | null
  raw_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface WppContact {
  id: string
  instance_id: string
  wa_contact_id: string
  phone: string | null
  name: string | null
  push_name: string | null
  profile_pic_url: string | null
  is_business: boolean
  is_group: boolean
  owner_id: string | null
  lead_id: string | null
  created_at: string
  updated_at: string
  // Nested joins
  owner?: { id: string; name: string; phone: string | null; email: string | null } | null
  lead?: { id: string; nome: string; email: string | null; telemovel: string | null } | null
}

export interface WppChat {
  id: string
  instance_id: string
  wa_chat_id: string
  contact_id: string | null
  name: string | null
  phone: string | null
  is_group: boolean
  is_archived: boolean
  is_pinned: boolean
  is_muted: boolean
  mute_until: string | null
  unread_count: number
  last_message_text: string | null
  last_message_timestamp: number | null
  last_message_from_me: boolean | null
  profile_pic_url: string | null
  created_at: string
  updated_at: string
  // Nested join
  contact: WppContact | null
}

export interface PresenceState {
  type: 'composing' | 'recording' | 'paused' | 'unavailable'
  chatId: string
  timestamp: number
}

export interface QuotedMessageMap {
  [wa_message_id: string]: {
    text: string | null
    message_type: WppMessageType
    sender_name: string | null
    from_me: boolean
    media_url: string | null
  }
}

export const MESSAGE_TYPE_LABELS: Record<WppMessageType, string> = {
  text: 'Texto',
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  document: 'Documento',
  sticker: 'Sticker',
  location: 'Localização',
  contact: 'Contacto',
  reaction: 'Reacção',
  poll: 'Sondagem',
  view_once: 'Ver Uma Vez',
}

export const MESSAGE_STATUS_LABELS: Record<WppMessageStatus, string> = {
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  played: 'Reproduzida',
  failed: 'Falhou',
}
