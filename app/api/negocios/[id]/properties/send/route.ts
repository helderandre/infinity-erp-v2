import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/permissions'
import { WHATSAPP_ADMIN_ROLES } from '@/lib/auth/roles'
import { pLimit } from '@/lib/concurrency'
import {
  MAX_PROPERTY_IDS_PER_SEND,
  MAX_RECIPIENTS_PER_CHANNEL,
} from '@/lib/documents/send-defaults'
import { resolveEmailAccount } from '@/lib/email/resolve-account'
import {
  formatEurosPt,
  renderPropertyGrid,
  type PropertyCardInput,
} from '@/lib/email/property-card-html'
import { wrapEmailHtml } from '@/lib/email-renderer'
import { buildPublicPropertyUrl } from '@/lib/constants'
import { createAdminClient } from '@/lib/supabase/admin'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const EDGE_SMTP_SECRET = process.env.EDGE_SMTP_SECRET || ''

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const emailSchema = z.object({
  account_id: z.string().regex(UUID_RE),
  subject: z.string().min(1),
  body_html: z.string().min(1),
  recipients: z
    .array(z.string().email())
    .min(1)
    .max(MAX_RECIPIENTS_PER_CHANNEL),
})

const whatsappSchema = z.object({
  instance_id: z.string().regex(UUID_RE),
  message: z.string().optional(),
  recipients: z
    .array(z.string().regex(/^\+[1-9]\d{7,14}$/))
    .min(1)
    .max(MAX_RECIPIENTS_PER_CHANNEL),
})

const bodySchema = z.object({
  negocio_property_ids: z
    .array(z.string().regex(UUID_RE))
    .min(1)
    .max(MAX_PROPERTY_IDS_PER_SEND),
  email: emailSchema.optional(),
  whatsapp: whatsappSchema.optional(),
})

type SendResult = {
  channel: 'email' | 'whatsapp'
  to: string
  status: 'success' | 'failed'
  error?: string
}

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
  phone: string
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
        .join(',')
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
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/whatsapp-messaging`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(payload),
    }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`WhatsApp edge ${res.status}: ${text.slice(0, 200)}`)
  }
}

type NegocioPropertyRow = {
  id: string
  property_id: string | null
  external_url: string | null
  external_title: string | null
  external_price: number | null
  property: {
    id: string
    title: string | null
    external_ref: string | null
    slug: string | null
    city: string | null
    zone: string | null
    listing_price: number | null
    dev_property_specifications: Array<{
      bedrooms: number | null
      area_util: number | null
      typology: string | null
    }> | null
    dev_property_media: Array<{
      url: string
      is_cover: boolean | null
      order_index: number | null
    }> | null
  } | null
}

function toCardInput(row: NegocioPropertyRow): PropertyCardInput {
  if (row.property_id && row.property) {
    const p = row.property
    const specs = Array.isArray(p.dev_property_specifications)
      ? p.dev_property_specifications[0]
      : p.dev_property_specifications
    const mediaList = Array.isArray(p.dev_property_media)
      ? [...p.dev_property_media].sort(
          (a, b) => (a.order_index ?? 999) - (b.order_index ?? 999)
        )
      : []
    const cover = mediaList.find((m) => m.is_cover) ?? mediaList[0]
    const specParts: string[] = []
    if (specs?.bedrooms) specParts.push(`${specs.bedrooms} quartos`)
    if (specs?.area_util) specParts.push(`${specs.area_util} m²`)
    const location = [p.city, p.zone].filter(Boolean).join(' · ')
    return {
      title: p.title || 'Imóvel',
      priceLabel: formatEurosPt(p.listing_price),
      location,
      specs: specParts.join(' · '),
      imageUrl: cover?.url ?? null,
      href: p.slug ? buildPublicPropertyUrl(p.slug) : '#',
      reference: p.external_ref ?? null,
    }
  }
  return {
    title: row.external_title || 'Imóvel externo',
    priceLabel: formatEurosPt(row.external_price),
    location: '',
    specs: '',
    imageUrl: null,
    href: row.external_url || '#',
    reference: null,
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: negocioId } = await params
    const raw = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { negocio_property_ids, email, whatsapp } = parsed.data

    if (!email && !whatsapp) {
      return NextResponse.json(
        { error: 'Active pelo menos um canal' },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    // Load dossier rows
    const { data: rows, error: rowsErr } = await admin
      .from('negocio_properties')
      .select(
        `id, property_id, external_url, external_title, external_price,
         property:dev_properties!property_id(
           id, title, external_ref, slug, city, zone, listing_price,
           dev_property_specifications(bedrooms, area_util, typology),
           dev_property_media(url, is_cover, order_index)
         )`
      )
      .eq('negocio_id', negocioId)
      .in('id', negocio_property_ids)

    if (rowsErr) {
      return NextResponse.json({ error: rowsErr.message }, { status: 500 })
    }
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum imóvel encontrado no dossier' },
        { status: 404 }
      )
    }

    const cards = (rows as NegocioPropertyRow[]).map(toCardInput)

    // Resolve email account
    let resolvedAccount:
      | Awaited<ReturnType<typeof resolveEmailAccount>>
      | null = null
    if (email) {
      resolvedAccount = await resolveEmailAccount(email.account_id)
      if (!resolvedAccount.ok) {
        return NextResponse.json(
          { error: resolvedAccount.error },
          { status: resolvedAccount.status }
        )
      }
    }

    // Resolve WhatsApp instance
    const isWhatsappAdmin = auth.roles.some((r) =>
      WHATSAPP_ADMIN_ROLES.some(
        (allowed) => allowed.toLowerCase() === r.toLowerCase()
      )
    )
    let whatsappInstance: { id: string; uazapi_token: string } | null = null
    if (whatsapp) {
      const { data: instance, error } = await admin
        .from('auto_wpp_instances')
        .select('id, user_id, uazapi_token, status, connection_status')
        .eq('id', whatsapp.instance_id)
        .maybeSingle()
      if (error || !instance) {
        return NextResponse.json(
          { error: 'Instância de WhatsApp não encontrada' },
          { status: 404 }
        )
      }
      if (instance.status !== 'active') {
        return NextResponse.json(
          { error: 'Instância de WhatsApp inactiva' },
          { status: 400 }
        )
      }
      if (instance.connection_status !== 'connected') {
        return NextResponse.json(
          { error: 'Instância de WhatsApp não está conectada' },
          { status: 400 }
        )
      }
      if (!isWhatsappAdmin && instance.user_id !== auth.user.id) {
        return NextResponse.json(
          { error: 'Sem permissão para usar esta instância' },
          { status: 403 }
        )
      }
      whatsappInstance = {
        id: instance.id,
        uazapi_token: instance.uazapi_token,
      }
    }

    const results: SendResult[] = []
    const emailLimit = pLimit(3)
    // WhatsApp dispatch is now strictly sequential with a randomised
    // delay (see the loop below) — no concurrency limiter needed.

    // EMAIL — merge intro (body_html) with the rendered grid and wrap
    if (email && resolvedAccount?.ok) {
      const grid = renderPropertyGrid(cards)
      const html = wrapEmailHtml(`${email.body_html}${grid}`)
      const { account, password } = resolvedAccount.data
      const edgeUrl = `${SUPABASE_URL}/functions/v1/smtp-send`

      await Promise.all(
        email.recipients.map((to) =>
          emailLimit(async () => {
            try {
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
                to: [to],
                subject: email.subject,
                html,
              }
              const res = await fetch(edgeUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(EDGE_SMTP_SECRET
                    ? { 'x-edge-secret': EDGE_SMTP_SECRET }
                    : {}),
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
              if (!payload.ok) {
                throw new Error(payload.error || 'SMTP falhou')
              }
              results.push({ channel: 'email', to, status: 'success' })
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : 'Erro desconhecido'
              results.push({
                channel: 'email',
                to,
                status: 'failed',
                error: msg,
              })
            }
          })
        )
      )
    }

    // WHATSAPP — one text message per recipient with enumerated list.
    //
    // Anti-ban: send strictly SEQUENTIAL with a jittered 8–20 s delay
    // between each recipient. UazAPI's bot-detection (and WhatsApp's
    // own) is pattern-based — sub-3 s spacing or pure-concurrent fan-
    // out is the fastest way to get an instance flagged. Random
    // 8–20 s pacing keeps the cadence "human enough" while still being
    // fast enough for typical bulk sends. The first message goes out
    // immediately; the delay only kicks in between subsequent ones.
    if (whatsapp && whatsappInstance) {
      const defaultMessage = buildDefaultWhatsappText(cards)
      const text = whatsapp.message?.trim() || defaultMessage

      for (let i = 0; i < whatsapp.recipients.length; i++) {
        const to = whatsapp.recipients[i]
        if (i > 0) {
          const delayMs = 8000 + Math.floor(Math.random() * 12000)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
        try {
          const chat = await resolveWhatsappChat(whatsappInstance!.id, to)
          if (!chat) {
            throw new Error('Não foi possível resolver o chat')
          }
          await callWhatsappEdge({
            action: 'send_text',
            instance_id: whatsappInstance!.id,
            wa_chat_id: chat.waChatId,
            text,
          })
          results.push({ channel: 'whatsapp', to, status: 'success' })
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Erro desconhecido'
          results.push({
            channel: 'whatsapp',
            to,
            status: 'failed',
            error: msg,
          })
        }
      }
    }

    const attempted = results.length
    const succeeded = results.filter((r) => r.status === 'success').length

    // Persist sent_at if any channel succeeded
    if (succeeded > 0) {
      await admin
        .from('negocio_properties')
        .update({ sent_at: new Date().toISOString() })
        .in('id', negocio_property_ids)
    }

    // Activity feed: 1 linha por canal que teve sucesso (aparece em "Actividade recente"
    // do negócio).
    if (succeeded > 0) {
      try {
        const { data: neg } = await admin
          .from('negocios')
          .select('lead_id')
          .eq('id', negocioId)
          .single()
        if (neg?.lead_id) {
          const titles = cards.map((c) => c.title).slice(0, 8)
          const summary =
            titles.join(', ') +
            (cards.length > 8 ? `, +${cards.length - 8}` : '')
          const activities: any[] = []
          const emailSucceeded =
            !!email &&
            results.some((r) => r.channel === 'email' && r.status === 'success')
          const whatsappSucceeded =
            !!whatsapp &&
            results.some(
              (r) => r.channel === 'whatsapp' && r.status === 'success',
            )
          const noun = cards.length === 1 ? 'imóvel' : 'imóveis'
          if (emailSucceeded) {
            activities.push({
              contact_id: neg.lead_id,
              negocio_id: negocioId,
              activity_type: 'email',
              direction: 'outbound',
              subject: `Enviou ${cards.length} ${noun} por email`,
              description: summary,
              metadata: { property_count: cards.length, channel: 'email' },
              created_by: auth.user.id,
            })
          }
          if (whatsappSucceeded) {
            activities.push({
              contact_id: neg.lead_id,
              negocio_id: negocioId,
              activity_type: 'whatsapp',
              direction: 'outbound',
              subject: `Enviou ${cards.length} ${noun} pelo WhatsApp`,
              description: summary,
              metadata: { property_count: cards.length, channel: 'whatsapp' },
              created_by: auth.user.id,
            })
          }
          if (activities.length > 0) {
            await admin.from('leads_activities').insert(activities)
          }

          // Registry — contact_property_sends. One row per (contact,
          // property, channel). Only real properties (not external URLs)
          // are tracked here; external entries don't have a stable
          // property_id to key against. Used by the kanban bulk send +
          // by the "potenciais interessados" badge on each imóvel.
          const realPropertyIds = (rows as any[])
            .map((r) => r.property_id)
            .filter(Boolean) as string[]
          if (realPropertyIds.length > 0) {
            const sentRows: any[] = []
            if (emailSucceeded) {
              for (const pid of realPropertyIds) {
                sentRows.push({
                  contact_id: neg.lead_id,
                  property_id: pid,
                  channel: 'email',
                  source_negocio_id: negocioId,
                  sent_by: auth.user.id,
                })
              }
            }
            if (whatsappSucceeded) {
              for (const pid of realPropertyIds) {
                sentRows.push({
                  contact_id: neg.lead_id,
                  property_id: pid,
                  channel: 'whatsapp',
                  source_negocio_id: negocioId,
                  sent_by: auth.user.id,
                })
              }
            }
            if (sentRows.length > 0) {
              await admin.from('contact_property_sends').insert(sentRows)
            }
          }
        }
      } catch (actErr) {
        console.warn('[negocios/properties/send] activity log failed:', actErr)
      }
    }

    // Audit
    try {
      await admin.from('log_audit').insert({
        user_id: auth.user.id,
        entity_type: 'negocio_properties',
        entity_id: negocioId,
        action: 'negocio_properties.send',
        new_data: {
          negocio_property_ids,
          channels: {
            email: email
              ? {
                  account_id: email.account_id,
                  recipients: email.recipients.length,
                  subject: email.subject,
                }
              : null,
            whatsapp: whatsapp
              ? {
                  instance_id: whatsapp.instance_id,
                  recipients: whatsapp.recipients.length,
                }
              : null,
          },
          results,
        },
      })
    } catch (auditErr) {
      console.warn('[negocios/properties/send] audit insert failed:', auditErr)
    }

    return NextResponse.json({ results, attempted, succeeded })
  } catch (err) {
    console.error('[negocios/properties/send] Exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

function buildDefaultWhatsappText(cards: PropertyCardInput[]): string {
  const intro =
    cards.length === 1
      ? 'Partilho o imóvel abaixo:'
      : `Partilho os ${cards.length} imóveis abaixo:`
  const list = cards
    .map(
      (p, i) =>
        `${i + 1}. ${p.title}${p.priceLabel ? ` — ${p.priceLabel}` : ''}\n${p.href}`
    )
    .join('\n\n')
  return `${intro}\n\n${list}`
}
