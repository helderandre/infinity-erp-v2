import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/permissions'
import { pLimit } from '@/lib/concurrency'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import {
  formatEurosPt,
  renderPropertyGrid,
  type PropertyCardInput,
} from '@/lib/email/property-card-html'
import { wrapEmailHtml } from '@/lib/email-renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const EDGE_SMTP_SECRET = process.env.EDGE_SMTP_SECRET || ''

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const recipientSchema = z.object({
  lead_id: z.string().regex(UUID_RE).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
})

const bodySchema = z.object({
  channel: z.enum(['email', 'whatsapp']),
  recipients: z.array(recipientSchema).min(1).max(50),
  intro: z.string().max(2_000).optional(),
  // Email-specific
  subject: z.string().max(300).optional(),
  account_id: z.string().regex(UUID_RE).optional(),
  // WhatsApp-specific
  instance_id: z.string().regex(UUID_RE).optional(),
})

type SendResult = {
  channel: 'email' | 'whatsapp'
  to: string
  status: 'success' | 'failed'
  error?: string
}

// ── WhatsApp helpers (mirrors the negocios send route) ─────────────
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

function toE164Pt(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('351')) return `+${digits}`
  if (digits.length === 9) return `+351${digits}`
  return `+${digits}`
}

async function resolveWhatsappChat(
  instanceId: string,
  phone: string,
): Promise<{ chatId: string; waChatId: string } | null> {
  const admin = createAdminClient() as any
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

function buildPublicUrl(request: Request, slugOrId: string): string {
  const isInternal = (h: string | null | undefined) =>
    !h || h.startsWith('0.0.0.0') || h.startsWith('127.0.0.1') || h.startsWith('localhost')
  if (process.env.NEXT_PUBLIC_APP_URL)
    return `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/apresentacao/${slugOrId}`
  const h = request.headers
  const proto = h.get('x-forwarded-proto') || 'https'
  const fwd = h.get('x-forwarded-host')
  if (!isInternal(fwd)) return `${proto}://${fwd}/apresentacao/${slugOrId}`
  const host = h.get('host')
  if (!isInternal(host)) return `${proto}://${host}/apresentacao/${slugOrId}`
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}/apresentacao/${slugOrId}`
}

function buildWhatsAppText(opts: {
  intro?: string
  title: string
  price: string | null
  location: string
  publicUrl: string
}): string {
  const { intro, title, price, location, publicUrl } = opts
  const bits: string[] = []
  if (intro && intro.trim()) bits.push(intro.trim())
  bits.push(`🏠 *${title}*`)
  if (location) bits.push(`📍 ${location}`)
  if (price) bits.push(`💶 ${price}`)
  bits.push(publicUrl)
  return bits.join('\n')
}

function buildDefaultEmailSubject(title: string): string {
  return `Imóvel · ${title}`
}

function buildDefaultIntro(title: string, firstName?: string): string {
  const hi = firstName ? `Olá ${firstName}, ` : 'Olá, '
  return `${hi}partilho consigo este imóvel — ${title} — que me parece fazer sentido para si. Qualquer questão estou ao dispor.`
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const raw = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const {
      channel,
      recipients,
      intro,
      subject,
      account_id,
      instance_id,
    } = parsed.data

    const admin = createAdminClient() as any

    // Load property (minimal fields)
    const { data: property, error: propErr } = await admin
      .from('dev_properties')
      .select(
        `id, slug, title, external_ref, city, zone, listing_price,
         dev_property_specifications(bedrooms, area_util, typology),
         dev_property_media(url, is_cover, order_index)`,
      )
      .eq('id', id)
      .maybeSingle()

    if (propErr || !property) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    const slugOrId = property.slug || property.id
    const publicUrl = buildPublicUrl(request, slugOrId)
    const cover =
      (property.dev_property_media || [])
        .slice()
        .sort(
          (a: any, b: any) =>
            (a.is_cover === b.is_cover ? 0 : a.is_cover ? -1 : 1) ||
            (a.order_index ?? 0) - (b.order_index ?? 0),
        )
        .find((m: any) => m.url)?.url || null

    const locationText = [property.zone, property.city].filter(Boolean).join(', ')
    const priceText = property.listing_price != null
      ? formatEurosPt(Number(property.listing_price))
      : null
    const specs = property.dev_property_specifications
    const specsLine = [
      specs?.typology,
      specs?.bedrooms != null ? `${specs.bedrooms} quartos` : null,
      specs?.area_util ? `${specs.area_util}m²` : null,
    ]
      .filter(Boolean)
      .join(' · ')

    // Resolve recipient emails/phones
    const leadIds = recipients
      .map((r) => r.lead_id)
      .filter((x): x is string => !!x)

    let leads: Array<{ id: string; nome: string | null; email: string | null; telemovel: string | null }> = []
    if (leadIds.length > 0) {
      const { data } = await admin
        .from('leads')
        .select('id, nome, email, telemovel')
        .in('id', leadIds)
      leads = (data || []) as any
    }
    const leadById = new Map(leads.map((l) => [l.id, l]))

    // Build per-recipient list for the target channel
    type Resolved = { key: string; lead?: (typeof leads)[number]; name?: string }
    const resolved: Resolved[] = []
    for (const r of recipients) {
      const lead = r.lead_id ? leadById.get(r.lead_id) : undefined
      if (channel === 'email') {
        const email = r.email || lead?.email
        if (email) resolved.push({ key: email, lead, name: r.name || lead?.nome || undefined })
      } else {
        const rawPhone = r.phone || lead?.telemovel
        if (rawPhone) {
          const e164 = toE164Pt(rawPhone)
          resolved.push({ key: e164, lead, name: r.name || lead?.nome || undefined })
        }
      }
    }

    if (resolved.length === 0) {
      return NextResponse.json(
        {
          error:
            channel === 'email'
              ? 'Nenhum destinatário com email válido'
              : 'Nenhum destinatário com telemóvel',
        },
        { status: 400 },
      )
    }

    const results: SendResult[] = []

    // ── EMAIL ────────────────────────────────────────────────
    if (channel === 'email') {
      const resolvedAccount = await resolveEmailAccount(account_id)
      if (!resolvedAccount.ok) {
        return NextResponse.json(
          { error: resolvedAccount.error },
          { status: resolvedAccount.status },
        )
      }
      const { account, password } = resolvedAccount.data

      const card: PropertyCardInput = {
        title: property.title || 'Imóvel',
        priceLabel: priceText || '',
        location: locationText,
        specs: specsLine,
        imageUrl: cover,
        href: publicUrl,
        reference: property.external_ref || null,
      }
      const finalSubject = subject?.trim() || buildDefaultEmailSubject(card.title)
      const edgeUrl = `${SUPABASE_URL}/functions/v1/smtp-send`
      const limit = pLimit(3)

      await Promise.all(
        resolved.map((r) =>
          limit(async () => {
            try {
              const personalIntro =
                intro?.trim() ||
                buildDefaultIntro(card.title, firstNameOf(r.name))
              const body = `<p style="margin:0 0 14px 0; color:#27272a; font-size:14px; line-height:1.55;">${escapeHtml(
                personalIntro,
              ).replace(/\n/g, '<br/>')}</p>${renderPropertyGrid([card], { columns: 1 })}`
              const html = wrapEmailHtml(body)

              const edgePayload = {
                smtp: {
                  host: account.smtp_host,
                  port: account.smtp_port,
                  secure: account.smtp_secure,
                  user: account.email_address,
                  pass: password,
                },
                from: {
                  name: account.display_name,
                  address: account.email_address,
                },
                to: [r.key],
                subject: finalSubject,
                html,
              }
              const res = await fetch(edgeUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(EDGE_SMTP_SECRET ? { 'x-edge-secret': EDGE_SMTP_SECRET } : {}),
                },
                body: JSON.stringify(edgePayload),
              })
              const text = await res.text()
              let payload: { ok?: boolean; error?: string } = {}
              try {
                payload = JSON.parse(text)
              } catch {
                throw new Error(`Edge non-JSON: ${text.slice(0, 160)}`)
              }
              if (!payload.ok) throw new Error(payload.error || 'SMTP falhou')
              results.push({ channel: 'email', to: r.key, status: 'success' })
            } catch (err) {
              results.push({
                channel: 'email',
                to: r.key,
                status: 'failed',
                error: err instanceof Error ? err.message : 'Erro desconhecido',
              })
            }
          }),
        ),
      )
    }

    // ── WHATSAPP ─────────────────────────────────────────────
    if (channel === 'whatsapp') {
      // Resolve instance: explicit → user's own → any of the consultor's
      let whatsappInstance: { id: string } | null = null
      if (instance_id) {
        const { data: inst } = await admin
          .from('auto_wpp_instances')
          .select('id, user_id, status, connection_status')
          .eq('id', instance_id)
          .maybeSingle()
        if (!inst) {
          return NextResponse.json(
            { error: 'Instância de WhatsApp não encontrada' },
            { status: 404 },
          )
        }
        whatsappInstance = { id: inst.id }
      } else {
        const { data: inst } = await admin
          .from('auto_wpp_instances')
          .select('id')
          .eq('user_id', auth.user.id)
          .eq('status', 'active')
          .eq('connection_status', 'connected')
          .limit(1)
          .maybeSingle()
        if (!inst) {
          return NextResponse.json(
            {
              error:
                'Sem instância de WhatsApp ligada para o seu utilizador. Configure em Automações → WhatsApp.',
            },
            { status: 400 },
          )
        }
        whatsappInstance = { id: inst.id }
      }

      const limit = pLimit(2)
      await Promise.all(
        resolved.map((r) =>
          limit(async () => {
            try {
              const chat = await resolveWhatsappChat(whatsappInstance!.id, r.key)
              if (!chat) throw new Error('Não foi possível resolver o chat')

              const personalIntro =
                intro?.trim() ||
                buildDefaultIntro(property.title, firstNameOf(r.name))
              const text = buildWhatsAppText({
                intro: personalIntro,
                title: property.title,
                price: priceText,
                location: locationText,
                publicUrl,
              })

              await callWhatsappEdge({
                action: 'send_text',
                instance_id: whatsappInstance!.id,
                wa_chat_id: chat.waChatId,
                text,
              })
              results.push({ channel: 'whatsapp', to: r.key, status: 'success' })
            } catch (err) {
              results.push({
                channel: 'whatsapp',
                to: r.key,
                status: 'failed',
                error: err instanceof Error ? err.message : 'Erro desconhecido',
              })
            }
          }),
        ),
      )
    }

    // Audit log (best-effort)
    try {
      const supabase = await createClient()
      await supabase.from('log_audit').insert({
        user_id: auth.user.id,
        entity_type: 'property',
        entity_id: property.id,
        action: `share.${channel}`,
        new_data: {
          recipient_count: resolved.length,
          success: results.filter((r) => r.status === 'success').length,
          failed: results.filter((r) => r.status === 'failed').length,
        },
      } as any)
    } catch {}

    const success = results.filter((r) => r.status === 'success').length
    const failed = results.filter((r) => r.status === 'failed').length
    return NextResponse.json({ results, success, failed })
  } catch (error) {
    console.error('[share property] erro:', error)
    return NextResponse.json(
      {
        error: 'Erro ao partilhar imóvel',
        details: error instanceof Error ? error.message : 'erro desconhecido',
      },
      { status: 500 },
    )
  }
}

function firstNameOf(name?: string): string | undefined {
  if (!name) return undefined
  return name.split(/\s+/)[0]
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
