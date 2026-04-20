import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const bodySchema = z.object({
  phones: z.array(z.string().min(1)).min(1).max(20),
  text: z.string().min(1),
})

// ── Helpers ──────────────────────────────────────────────────────────────

function toE164PT(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('351')) return `+${digits}`
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  if (digits.length === 9 && digits.startsWith('9')) return `+351${digits}`
  if (digits.length >= 10) return `+${digits}`
  return null
}

function toJid(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  return `${digits}@s.whatsapp.net`
}

function phoneVariants(e164: string): string[] {
  const digits = e164.replace(/\D/g, '')
  const set = new Set<string>()
  set.add(digits)
  set.add(`+${digits}`)
  if (digits.startsWith('351')) set.add(digits.slice(3))
  else if (digits.length === 9) set.add(`351${digits}`)
  set.add(`${digits}@s.whatsapp.net`)
  if (digits.startsWith('351')) set.add(`${digits.slice(3)}@s.whatsapp.net`)
  return [...set]
}

async function resolveChat(
  instanceId: string,
  e164: string
): Promise<string | null> {
  const admin = createAdminClient()
  const variants = phoneVariants(e164)

  const { data: chats } = await admin
    .from('wpp_chats')
    .select('id, wa_chat_id')
    .eq('instance_id', instanceId)
    .eq('is_group', false)
    .or(
      variants
        .map((v) => `phone.eq.${v}`)
        .concat(variants.map((v) => `wa_chat_id.eq.${v}`))
        .join(',')
    )
    .order('last_message_timestamp', { ascending: false, nullsFirst: false })
    .limit(1)

  if (chats?.length) {
    return (chats[0] as any).wa_chat_id as string
  }

  // Create a fresh wpp_chats row for this phone.
  const jid = toJid(e164)
  const digits = e164.replace(/\D/g, '')
  const { data: created, error } = await admin
    .from('wpp_chats')
    .insert({
      instance_id: instanceId,
      wa_chat_id: jid,
      name: digits,
      phone: digits,
      is_group: false,
      is_archived: false,
      unread_count: 0,
    } as any)
    .select('wa_chat_id')
    .single()

  if (error || !created) return null
  return (created as any).wa_chat_id as string
}

async function callEdge(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-messaging`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`WhatsApp edge ${res.status}: ${text.slice(0, 180)}`)
  }
}

// ── POST ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { phones, text } = parsed.data

    // Auto-resolve the caller's active WhatsApp instance. If the user owns
    // multiple instances we pick the most recently updated active one.
    const admin = createAdminClient()
    const { data: instances, error: instErr } = await admin
      .from('auto_wpp_instances')
      .select('id, uazapi_token, status, connection_status, updated_at')
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .eq('connection_status', 'connected')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)

    if (instErr) {
      return NextResponse.json({ error: instErr.message }, { status: 500 })
    }
    const instance = instances?.[0] as { id: string } | undefined
    if (!instance) {
      return NextResponse.json(
        { error: 'Sem instância de WhatsApp conectada. Liga uma em Definições.' },
        { status: 400 }
      )
    }

    const details: Array<{ phone: string; ok: boolean; error?: string }> = []
    for (const raw of phones) {
      const e164 = toE164PT(raw)
      if (!e164) {
        details.push({ phone: raw, ok: false, error: 'Telefone inválido' })
        continue
      }
      try {
        const waChatId = await resolveChat(instance.id, e164)
        if (!waChatId) {
          details.push({ phone: raw, ok: false, error: 'Sem chat resolvido' })
          continue
        }
        await callEdge({
          action: 'send_text',
          instance_id: instance.id,
          wa_chat_id: waChatId,
          text,
        })
        details.push({ phone: raw, ok: true })
      } catch (err) {
        details.push({
          phone: raw,
          ok: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        })
      }
    }

    const sent = details.filter((d) => d.ok).length
    const failed = details.length - sent
    return NextResponse.json({ sent, failed, details })
  } catch (error) {
    console.error('Erro em voice/whatsapp-send:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
