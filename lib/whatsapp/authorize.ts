import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WHATSAPP_ADMIN_ROLES } from '@/lib/auth/roles'

// Ownership helpers for the WhatsApp module.
//
// Business rule:
// - Each user sees ONLY the chats/messages/contacts from instances they own.
// - Admins/Broker/CEO/Gestor Processual may MANAGE instances (create, delete,
//   rename, connect/disconnect, webhooks) but MUST NOT read conversation
//   content of instances owned by someone else.
//
// → `assertInstanceOwner` and its chat/message/contact variants DO NOT grant
//   access to admins. Only the instance owner passes the check.
// → `assertInstanceOwnerOrAdmin` is exposed for the narrow set of management
//   actions that legitimately need admin override (webhook registration,
//   forced sync, etc.). Never use it on routes that return conversation data.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

export interface WhatsAppAuthOk {
  ok: true
  userId: string
  isAdmin: boolean
  roles: string[]
}
export interface WhatsAppAuthFail {
  ok: false
  response: NextResponse
}
export type WhatsAppAuth = WhatsAppAuthOk | WhatsAppAuthFail

export interface ChatOwnerOk extends WhatsAppAuthOk {
  instanceId: string
  waChatId: string
  chatId: string
}
export interface MessageOwnerOk extends WhatsAppAuthOk {
  instanceId: string
  waMessageId: string
  chatId: string
  messageId: string
}
export interface ContactOwnerOk extends WhatsAppAuthOk {
  instanceId: string
  contactId: string
}

const unauthorized = () =>
  NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
const forbidden = (message = 'Sem permissão para esta instância') =>
  NextResponse.json({ error: message }, { status: 403 })
const notFound = (message = 'Recurso não encontrado') =>
  NextResponse.json({ error: message }, { status: 404 })

/** Require authenticated user. Returns id + admin flag (for management only). */
export async function requireWhatsAppUser(): Promise<WhatsAppAuth> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: unauthorized() }

  const admin = createAdminClient() as SupabaseAdmin
  const { data: devUser } = await admin
    .from('dev_users')
    .select('user_roles!user_roles_user_id_fkey(role:roles(name))')
    .eq('id', user.id)
    .single()

  const roles: string[] = ((devUser as any)?.user_roles || [])
    .map((ur: any) => ur.role?.name)
    .filter(Boolean)

  const isAdmin = roles.some((r) =>
    WHATSAPP_ADMIN_ROLES.some((a) => a.toLowerCase() === r.toLowerCase())
  )

  return { ok: true, userId: user.id, isAdmin, roles }
}

/**
 * Content routes: only the instance owner passes.
 * Admin role is NOT honoured — admins must not read other users' conversations.
 */
export async function assertInstanceOwner(instanceId: string): Promise<WhatsAppAuth> {
  if (!instanceId) return { ok: false, response: forbidden('instance_id em falta') }
  const auth = await requireWhatsAppUser()
  if (!auth.ok) return auth

  const admin = createAdminClient() as SupabaseAdmin
  const { data: inst } = await admin
    .from('auto_wpp_instances')
    .select('user_id')
    .eq('id', instanceId)
    .single()

  if (!inst) return { ok: false, response: notFound('Instância não encontrada') }
  if (inst.user_id !== auth.userId) return { ok: false, response: forbidden() }
  return auth
}

/**
 * Management routes only: instance owner OR WhatsApp admin passes.
 * Use ONLY for endpoints that manage an instance without exposing chat/
 * message/contact content.
 */
export async function assertInstanceOwnerOrAdmin(
  instanceId: string
): Promise<WhatsAppAuth> {
  if (!instanceId) return { ok: false, response: forbidden('instance_id em falta') }
  const auth = await requireWhatsAppUser()
  if (!auth.ok) return auth
  if (auth.isAdmin) return auth

  const admin = createAdminClient() as SupabaseAdmin
  const { data: inst } = await admin
    .from('auto_wpp_instances')
    .select('user_id')
    .eq('id', instanceId)
    .single()

  if (!inst) return { ok: false, response: notFound('Instância não encontrada') }
  if (inst.user_id !== auth.userId) return { ok: false, response: forbidden() }
  return auth
}

/** Chat content: verifies chat → instance → userId match. */
export async function assertChatOwner(
  chatId: string
): Promise<{ ok: true; data: ChatOwnerOk } | WhatsAppAuthFail> {
  if (!chatId) return { ok: false, response: forbidden('chat_id em falta') }
  const auth = await requireWhatsAppUser()
  if (!auth.ok) return auth

  const admin = createAdminClient() as SupabaseAdmin
  const { data: chat } = await admin
    .from('wpp_chats')
    .select('id, instance_id, wa_chat_id')
    .eq('id', chatId)
    .single()

  if (!chat) return { ok: false, response: notFound('Chat não encontrado') }

  const { data: inst } = await admin
    .from('auto_wpp_instances')
    .select('user_id')
    .eq('id', chat.instance_id)
    .single()

  if (!inst || inst.user_id !== auth.userId) {
    return { ok: false, response: forbidden('Sem permissão para este chat') }
  }

  return {
    ok: true,
    data: {
      ...auth,
      chatId: chat.id,
      instanceId: chat.instance_id,
      waChatId: chat.wa_chat_id,
    },
  }
}

/** Message content: verifies message → instance → userId match. */
export async function assertMessageOwner(
  messageId: string
): Promise<{ ok: true; data: MessageOwnerOk } | WhatsAppAuthFail> {
  if (!messageId) return { ok: false, response: forbidden('message_id em falta') }
  const auth = await requireWhatsAppUser()
  if (!auth.ok) return auth

  const admin = createAdminClient() as SupabaseAdmin
  const { data: msg } = await admin
    .from('wpp_messages')
    .select('id, instance_id, wa_message_id, chat_id')
    .eq('id', messageId)
    .single()

  if (!msg) return { ok: false, response: notFound('Mensagem não encontrada') }

  const { data: inst } = await admin
    .from('auto_wpp_instances')
    .select('user_id')
    .eq('id', msg.instance_id)
    .single()

  if (!inst || inst.user_id !== auth.userId) {
    return { ok: false, response: forbidden('Sem permissão para esta mensagem') }
  }

  return {
    ok: true,
    data: {
      ...auth,
      messageId: msg.id,
      instanceId: msg.instance_id,
      waMessageId: msg.wa_message_id,
      chatId: msg.chat_id,
    },
  }
}

/** Contact content: verifies contact → instance → userId match. */
export async function assertContactOwner(
  contactId: string
): Promise<{ ok: true; data: ContactOwnerOk } | WhatsAppAuthFail> {
  if (!contactId) return { ok: false, response: forbidden('contact_id em falta') }
  const auth = await requireWhatsAppUser()
  if (!auth.ok) return auth

  const admin = createAdminClient() as SupabaseAdmin
  const { data: contact } = await admin
    .from('wpp_contacts')
    .select('id, instance_id')
    .eq('id', contactId)
    .single()

  if (!contact) return { ok: false, response: notFound('Contacto não encontrado') }

  const { data: inst } = await admin
    .from('auto_wpp_instances')
    .select('user_id')
    .eq('id', contact.instance_id)
    .single()

  if (!inst || inst.user_id !== auth.userId) {
    return { ok: false, response: forbidden('Sem permissão para este contacto') }
  }

  return {
    ok: true,
    data: { ...auth, contactId: contact.id, instanceId: contact.instance_id },
  }
}
