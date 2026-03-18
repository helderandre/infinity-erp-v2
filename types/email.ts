// ─── Email Integration Types ─────────────────────────────────────────────────

export interface ConsultantEmailAccount {
  id: string
  consultant_id: string
  email_address: string
  display_name: string
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  imap_host: string
  imap_port: number
  imap_secure: boolean
  is_verified: boolean
  is_active: boolean
  last_sync_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
  // Never expose encrypted_password to the client
}

export interface EmailMessage {
  id: string
  account_id: string
  process_id: string | null
  process_type: string | null
  message_id: string | null
  in_reply_to: string | null
  thread_id: string | null
  direction: 'inbound' | 'outbound'
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'received'
  from_address: string
  from_name: string | null
  to_addresses: string[]
  cc_addresses: string[]
  bcc_addresses: string[]
  subject: string
  body_text: string | null
  body_html: string | null
  imap_uid: number | null
  imap_folder: string | null
  is_read: boolean
  is_flagged: boolean
  has_attachments: boolean
  sent_at: string | null
  received_at: string | null
  created_at: string
  error_message: string | null
  // Joined
  attachments?: EmailAttachment[]
}

export interface EmailAttachment {
  id: string
  message_id: string
  filename: string
  content_type: string
  size_bytes: number
  storage_path: string
  cid: string | null
  is_inline: boolean
  created_at: string
}

export interface EmailFolder {
  name: string
  path: string
  flags: string[]
  delimiter: string
  messagesCount: number
  unseenCount: number
  special?: 'inbox' | 'sent' | 'drafts' | 'trash' | 'junk' | 'archive'
}

// ─── IMAP Message Envelope (used by hooks and components) ────────────────────

export interface ImapMessageEnvelope {
  uid: number
  messageId: string | null
  inReplyTo: string | null
  from: { name?: string; address?: string }[]
  to: { name?: string; address?: string }[]
  cc: { name?: string; address?: string }[]
  subject: string
  date: string | null
  flags: string[]
  size: number
  hasAttachments: boolean
}

// ─── API Payloads ────────────────────────────────────────────────────────────

export interface SetupEmailAccountPayload {
  email_address: string
  password: string
  display_name: string
  smtp_host?: string
  smtp_port?: number
  imap_host?: string
  imap_port?: number
}

export interface SendEmailPayload {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body_html: string
  body_text?: string
  in_reply_to?: string
  process_id?: string
  process_type?: string
  attachments?: { filename: string; content_type: string; data_base64: string }[]
}

export interface ComposeEmailData {
  to: string
  cc?: string
  bcc?: string
  subject: string
  body_html: string
  in_reply_to?: string
  process_id?: string
}
