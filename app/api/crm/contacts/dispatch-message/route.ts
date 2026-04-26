/**
 * POST /api/crm/contacts/bulk-message
 *
 * Multi-channel bulk messaging at the CONTACT level — used by the kanban
 * "Mensagem WhatsApp" / "Email" multi-select actions. Each target is a
 * contact (lead) with an optional source negócio for activity-log
 * attribution.
 *
 * Body shape:
 *   {
 *     targets: [{ contact_id: string, negocio_id?: string }],
 *     email?:    { account_id: UUID, subject, body_html },
 *     whatsapp?: { instance_id: UUID, message },
 *   }
 *
 * Per target:
 *   1. Looks up the contact's email + phone.
 *   2. Sends via email and/or WhatsApp through the same edge functions
 *      the rest of the app uses (smtp-send / whatsapp-messaging).
 *   3. Applies the same {{nome}} variable substitution the per-lead
 *      automations use, so a single template body personalises naturally.
 *   4. Logs one row per channel into `leads_activities` so the touchpoint
 *      shows up in the contact's timeline (and on the negócio's, if a
 *      source_negocio_id was provided).
 *
 * Anti-ban: WhatsApp recipients are dispatched strictly sequentially with
 * a randomised 8–20 s gap between them — mirroring the throttle inside
 * the property-send endpoint.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/permissions'
import { WHATSAPP_ADMIN_ROLES } from '@/lib/auth/roles'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import { wrapEmailHtml } from '@/lib/email-renderer'
import { createAdminClient } from '@/lib/supabase/admin'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TargetSchema = z.object({
  contact_id: z.string().regex(UUID_RE),
  negocio_id: z.string().regex(UUID_RE).optional(),
})

const BodySchema = z
  .object({
    targets: z.array(TargetSchema).min(1).max(100),
    email: z.object({
      account_id: z.string().regex(UUID_RE),
      subject:    z.string().min(1).max(300),
      body_html:  z.string().min(1).max(50_000),
    }).optional(),
    whatsapp: z.object({
      instance_id: z.string().regex(UUID_RE),
      message:     z.string().min(1).max(4_000),
    }).optional(),
  })
  .refine((b) => !!b.email || !!b.whatsapp, { message: 'Active pelo menos um canal' })

interface PerChannelResult { ok: boolean; skipped?: boolean; error?: string }
interface PerTargetResult {
  contact_id: string
  email?:    PerChannelResult
  whatsapp?: PerChannelResult
}

// ─── WhatsApp helpers — duplicated from negocios/properties/send/route.ts ──
// Keep the surface identical so the dispatch path stays consistent with
// the property-send code. Extract to lib/whatsapp/dispatch.ts when this
// pattern repeats once more.

function phoneVariants(e164: string): string[] {
  const digits = e164.replace(/\D/g, '')
  const variants = new Set<string>()
  variants.add(digits)
  variants.add(`+${digits}`)
  if (digits.startsWith('351')) variants.add(digits.slice(3))
  else if (digits.length === 9) variants.add(`351${digits}`)
  variants.add(`${digits}@s.whatsapp.net`)
  if (digits.startsWith('351')) variants.add(`${digits.slice(3)}@s.whatsapp.net`)
  return [...variants]
}

function toJid(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  const full =
    !digits.startsWith('351') && digits.length === 9 ? `351${digits}` : digits
  return `${full}@s.whatsapp.net`
}

async function resolveWhatsappChat(
  instanceId: string,
  phone: string,
): Promise<{ chatId: string; waChatId: string } | null> {
  const admin = createAdminClient()
  const variants = phoneVariants(phone)
  const { data: chats } = await admin
    .from('wpp_chats')
    .select('id, wa_chat_id')
    .eq('instance_id', instanceId)
    .eq('is_group', false)
    .or(
      variants
        .map((v) => `phone.eq.${v}`)
        .concat(variants.map((v) => `wa_chat_id.eq.${v}`))
        .join(','),
    )
    .order('last_message_timestamp', { ascending: false, nullsFirst: false })
    .limit(1)

  if (chats?.length) {
    return { chatId: chats[0].id as string, waChatId: chats[0].wa_chat_id as string }
  }
  const jid = toJid(phone)
  const digits = phone.replace(/\D/g, '')
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
    })
    .select('id, wa_chat_id')
    .single()
  if (error || !created) return null
  return { chatId: created.id as string, waChatId: created.wa_chat_id as string }
}

async function callWhatsappEdge(payload: Record<string, unknown>): Promise<void> {
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
    throw new Error(`WhatsApp edge ${res.status}: ${text.slice(0, 200)}`)
  }
}

// E.164 normaliser — same rules as the bulk-send-properties route.
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) {
    const candidate = `+${digits.slice(2)}`
    return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : null
  }
  if (digits.length === 9 && /^[29]/.test(digits)) {
    const candidate = `+351${digits}`
    return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : null
  }
  if (digits.length >= 10 && digits.length <= 15) {
    const candidate = `+${digits}`
    return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : null
  }
  return null
}

// Variable substitution — `{{nome}}` is the only one we expose for now.
// Add more keys here when the per-lead-automation library introduces them.
function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => vars[key] ?? '')
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const raw = await request.json().catch(() => null)
    const parsed = BodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { targets, email, whatsapp } = parsed.data

    const admin = createAdminClient() as any

    // Resolve email account (one for the whole batch).
    let resolvedAccount:
      | Awaited<ReturnType<typeof resolveEmailAccount>>
      | null = null
    if (email) {
      resolvedAccount = await resolveEmailAccount(email.account_id)
      if (!resolvedAccount.ok) {
        return NextResponse.json(
          { error: resolvedAccount.error },
          { status: resolvedAccount.status },
        )
      }
    }

    // Resolve WhatsApp instance once + check status.
    let whatsappInstance: { id: string } | null = null
    const isWhatsappAdmin = auth.roles.some((r) =>
      WHATSAPP_ADMIN_ROLES.some((x) => x.toLowerCase() === r.toLowerCase()),
    )
    if (whatsapp) {
      const { data: instance, error } = await admin
        .from('auto_wpp_instances')
        .select('id, user_id, status, connection_status')
        .eq('id', whatsapp.instance_id)
        .maybeSingle()
      if (error || !instance) {
        return NextResponse.json(
          { error: 'Instância de WhatsApp não encontrada' },
          { status: 404 },
        )
      }
      if (instance.status !== 'active') {
        return NextResponse.json(
          { error: 'Instância de WhatsApp inactiva' },
          { status: 400 },
        )
      }
      if (instance.connection_status !== 'connected') {
        return NextResponse.json(
          { error: 'Instância de WhatsApp não está conectada' },
          { status: 400 },
        )
      }
      if (!isWhatsappAdmin && instance.user_id !== auth.user.id) {
        return NextResponse.json(
          { error: 'Sem permissão para usar esta instância' },
          { status: 403 },
        )
      }
      whatsappInstance = { id: instance.id }
    }

    // Bulk-load every contact in the request.
    const contactIds = targets.map((t) => t.contact_id)
    const { data: contactRows, error: contactErr } = await admin
      .from('leads')
      .select('id, nome, email, telemovel')
      .in('id', contactIds)
    if (contactErr) {
      return NextResponse.json({ error: contactErr.message }, { status: 500 })
    }
    const contactById = new Map<string, any>()
    for (const c of (contactRows ?? []) as any[]) contactById.set(c.id, c)

    const results: PerTargetResult[] = []
    let lastWhatsappAtMs = 0  // anti-ban throttle across targets

    for (const target of targets) {
      const contact = contactById.get(target.contact_id)
      if (!contact) {
        results.push({
          contact_id: target.contact_id,
          email:    email    ? { ok: false, error: 'Contacto não encontrado' } : undefined,
          whatsapp: whatsapp ? { ok: false, error: 'Contacto não encontrado' } : undefined,
        })
        continue
      }

      const vars = { nome: contact.nome ?? '' }
      const out: PerTargetResult = { contact_id: target.contact_id }

      // ── EMAIL ────────────────────────────────────────────────────────
      if (email && resolvedAccount?.ok) {
        if (!contact.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
          out.email = { ok: false, skipped: true, error: 'Sem email' }
        } else {
          try {
            const subject = substituteVars(email.subject, vars)
            const bodyHtml = wrapEmailHtml(substituteVars(email.body_html, vars))
            const { account, password } = resolvedAccount.data
            const edgeUrl = `${SUPABASE_URL}/functions/v1/smtp-send`
            const edgePayload = {
              smtp: {
                host: account.smtp_host,
                port: account.smtp_port,
                secure: account.smtp_secure,
                user: account.email_address,
                pass: password,
              },
              from: {
                email: account.email_address,
                name: account.display_name ?? account.email_address,
              },
              to: [{ email: contact.email, name: contact.nome ?? '' }],
              subject,
              html: bodyHtml,
            }
            const res = await fetch(edgeUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_KEY}`,
              },
              body: JSON.stringify(edgePayload),
            })
            if (!res.ok) {
              const text = await res.text().catch(() => '')
              throw new Error(`SMTP ${res.status}: ${text.slice(0, 160)}`)
            }
            out.email = { ok: true }
          } catch (e) {
            out.email = {
              ok: false,
              error: e instanceof Error ? e.message : 'Erro desconhecido',
            }
          }
        }
      }

      // ── WHATSAPP ─────────────────────────────────────────────────────
      if (whatsapp && whatsappInstance) {
        const phone = toE164(contact.telemovel)
        if (!phone) {
          out.whatsapp = { ok: false, skipped: true, error: 'Sem telemóvel válido' }
        } else {
          // Anti-ban: jitter 8-20 s between whatsapp messages from the
          // same instance — never less than the gap since the last send.
          if (lastWhatsappAtMs > 0) {
            const sinceLast = Date.now() - lastWhatsappAtMs
            const minGap = 8000 + Math.floor(Math.random() * 12000)
            if (sinceLast < minGap) {
              await new Promise((r) => setTimeout(r, minGap - sinceLast))
            }
          }
          try {
            const text = substituteVars(whatsapp.message, vars)
            const chat = await resolveWhatsappChat(whatsappInstance.id, phone)
            if (!chat) throw new Error('Não foi possível resolver o chat')
            await callWhatsappEdge({
              action: 'send_text',
              instance_id: whatsappInstance.id,
              wa_chat_id: chat.waChatId,
              text,
            })
            lastWhatsappAtMs = Date.now()
            out.whatsapp = { ok: true }
          } catch (e) {
            out.whatsapp = {
              ok: false,
              error: e instanceof Error ? e.message : 'Erro desconhecido',
            }
          }
        }
      }

      // ── Activity log — one row per channel that succeeded ────────────
      try {
        const activities: any[] = []
        if (out.email?.ok) {
          activities.push({
            contact_id: target.contact_id,
            negocio_id: target.negocio_id ?? null,
            activity_type: 'email',
            direction: 'outbound',
            subject: substituteVars(email!.subject, vars),
            description: substituteVars(email!.body_html, vars).replace(/<[^>]+>/g, '').slice(0, 500),
            metadata: { channel: 'email', bulk: true },
            created_by: auth.user.id,
          })
        }
        if (out.whatsapp?.ok) {
          activities.push({
            contact_id: target.contact_id,
            negocio_id: target.negocio_id ?? null,
            activity_type: 'whatsapp',
            direction: 'outbound',
            subject: 'Mensagem WhatsApp',
            description: substituteVars(whatsapp!.message, vars).slice(0, 500),
            metadata: { channel: 'whatsapp', bulk: true },
            created_by: auth.user.id,
          })
        }
        if (activities.length > 0) {
          await admin.from('leads_activities').insert(activities)
        }
      } catch (actErr) {
        console.warn('[bulk-message] activity log failed:', actErr)
      }

      results.push(out)
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[bulk-message]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
