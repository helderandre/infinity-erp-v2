/**
 * Helpers de privacidade para o chat interno.
 *
 * Princípio: ninguém deve poder ler ou escrever mensagens num canal a que não
 * pertence. O canal global ("watercooler", `INTERNAL_CHAT_CHANNEL_ID`) é a
 * única excepção pública — todos os utilizadores autenticados são considerados
 * membros implícitos.
 *
 * A enforcement real vive em duas camadas:
 *   1. RLS na base — `is_internal_chat_member(uuid)` na migration de privacy.
 *   2. Estes helpers — chamados pelos route handlers para falhar com 403 cedo
 *      e garantir que `ensureDmMembership` corre antes do primeiro INSERT
 *      numa DM nova (sem isso, RLS rejeitaria a inserção).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { INTERNAL_CHAT_CHANNEL_ID } from '@/lib/constants'

const GLOBAL_CHANNEL_ID = INTERNAL_CHAT_CHANNEL_ID

export function isGlobalChannel(channelId: string): boolean {
  return channelId === GLOBAL_CHANNEL_ID
}

/**
 * Devolve true se `userId` pode ler/escrever em `channelId`.
 * Pode receber qualquer cliente Supabase — usa selects untyped para evitar
 * dependência das types regen.
 */
export async function isChannelMember(
  client: SupabaseClient,
  userId: string,
  channelId: string,
): Promise<boolean> {
  if (isGlobalChannel(channelId)) return true
  const db = client as unknown as {
    from: (t: string) => ReturnType<typeof client.from>
  }
  const { data, error } = await db
    .from('internal_chat_channel_members')
    .select('user_id')
    .eq('channel_id', channelId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return false
  return !!data
}

/**
 * Garante que ambos os utilizadores são membros do canal — chamado pelo
 * POST handler antes de inserir a primeira mensagem de uma DM nova. Idempotente.
 *
 * IMPORTANTE: deve ser chamado com o admin client (service role) — a tabela
 * `internal_chat_channel_members` tem RLS sem policy de INSERT para utilizadores
 * normais, por design.
 */
export async function ensureDmMembership(
  adminClient: SupabaseClient,
  channelId: string,
  userIds: [string, string],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isGlobalChannel(channelId)) {
    return { ok: false, error: 'Canal global não suporta membership manual.' }
  }
  if (userIds[0] === userIds[1]) {
    return { ok: false, error: 'DM precisa de 2 utilizadores distintos.' }
  }

  const db = adminClient as unknown as {
    from: (t: string) => ReturnType<typeof adminClient.from>
  }

  const rows = userIds.map((uid) => ({ channel_id: channelId, user_id: uid }))
  const { error } = await db
    .from('internal_chat_channel_members')
    .upsert(rows as never, { onConflict: 'channel_id,user_id', ignoreDuplicates: true })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * Resolve o `channel_id` de uma mensagem — usado pelos endpoints
 * `[messageId]/...` para gating: devolve null se a mensagem não existir,
 * caso contrário devolve o channel_id para depois passar a `isChannelMember`.
 */
export async function getMessageChannelId(
  client: SupabaseClient,
  messageId: string,
): Promise<string | null> {
  const db = client as unknown as {
    from: (t: string) => ReturnType<typeof client.from>
  }
  const { data, error } = await db
    .from('internal_chat_messages')
    .select('channel_id')
    .eq('id', messageId)
    .maybeSingle()
  if (error || !data) return null
  return (data as { channel_id: string }).channel_id
}
