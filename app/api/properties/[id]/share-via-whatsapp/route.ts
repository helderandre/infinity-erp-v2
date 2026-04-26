import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPublicPropertyUrl } from '@/lib/constants'

// Envia 1 imóvel a N negócios (interessados) via a instância WhatsApp do
// utilizador autenticado.
//
// Para cada negócio:
//   1. Resolve o chat WhatsApp do lead (usa wpp_chats existente ou cria).
//   2. Envia mensagem de texto formatada (título + preço + URL pública).
//   3. Faz upsert em negocio_properties com status='sent' + sent_at=now().
//   4. Regista actividade em leads_activities (activity_type='whatsapp').
//
// Resposta: { results: [{ negocio_id, ok, error?, sent_at? }] }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const bodySchema = z.object({
  negocio_ids: z.array(z.string().regex(UUID_RE)).min(1).max(20),
  /** Optional override message. Default = autogerada. */
  message: z.string().max(2000).optional(),
})

function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '')
  const variants = new Set<string>()
  variants.add(digits)
  variants.add(`+${digits}`)
  if (digits.startsWith('351')) variants.add(digits.slice(3))
  else if (digits.length === 9) variants.add(`351${digits}`)
  variants.add(`${digits}@s.whatsapp.net`)
  if (digits.startsWith('351')) variants.add(`${digits.slice(3)}@s.whatsapp.net`)
  return [...variants]
}

function toJid(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const full = !digits.startsWith('351') && digits.length === 9 ? `351${digits}` : digits
  return `${full}@s.whatsapp.net`
}

function fmtEuro(n: number | null): string {
  if (!n) return ''
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

interface PropertyForMessage {
  title: string | null
  slug: string | null
  listing_price: number | null
  city: string | null
  zone: string | null
  bedrooms: number | null
  area_util: number | null
}

function buildMessage(p: PropertyForMessage): string {
  const lines: string[] = []
  if (p.title) lines.push(`🏠 *${p.title}*`)
  if (p.listing_price) lines.push(`💰 ${fmtEuro(p.listing_price)}`)
  const specs: string[] = []
  if (p.bedrooms) specs.push(`T${p.bedrooms}`)
  if (p.area_util) specs.push(`${p.area_util} m²`)
  const loc = [p.city, p.zone].filter(Boolean).join(' · ')
  if (loc) specs.push(loc)
  if (specs.length) lines.push(specs.join(' · '))
  if (p.slug) lines.push('', buildPublicPropertyUrl(p.slug))
  return lines.join('\n')
}

async function resolveChat(
  admin: any,
  instanceId: string,
  phone: string,
  fallbackName: string
): Promise<{ chatId: string; waChatId: string } | null> {
  const variants = phoneVariants(phone)
  const { data: chats } = await admin
    .from('wpp_chats')
    .select('id, wa_chat_id')
    .eq('instance_id', instanceId)
    .eq('is_group', false)
    .or(
      variants.map((v) => `phone.eq.${v}`).concat(variants.map((v) => `wa_chat_id.eq.${v}`)).join(',')
    )
    .order('last_message_timestamp', { ascending: false, nullsFirst: false })
    .limit(1)

  if (chats?.length) {
    return { chatId: chats[0].id as string, waChatId: chats[0].wa_chat_id as string }
  }

  const jid = toJid(phone)
  const digits = phone.replace(/\D/g, '')
  const { data: created } = await admin
    .from('wpp_chats')
    .insert({
      instance_id: instanceId,
      wa_chat_id: jid,
      name: fallbackName || digits,
      phone: digits,
      is_group: false,
      is_archived: false,
      unread_count: 0,
    })
    .select('id, wa_chat_id')
    .single()

  if (!created) return null
  return { chatId: created.id as string, waChatId: created.wa_chat_id as string }
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
    throw new Error(`WhatsApp edge ${res.status}: ${text.slice(0, 200)}`)
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: propertyId } = await params
    if (!UUID_RE.test(propertyId)) {
      return NextResponse.json({ error: 'Property id inválido' }, { status: 400 })
    }

    const raw = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { negocio_ids, message: customMessage } = parsed.data

    const admin = createAdminClient() as any

    // 1) Property data
    const { data: prop, error: propErr } = await admin
      .from('dev_properties')
      .select(
        `id, title, slug, listing_price, city, zone,
         dev_property_specifications(bedrooms, area_util)`
      )
      .eq('id', propertyId)
      .maybeSingle()

    if (propErr || !prop) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    const specs = Array.isArray(prop.dev_property_specifications)
      ? prop.dev_property_specifications[0]
      : prop.dev_property_specifications
    const propForMessage: PropertyForMessage = {
      title: prop.title,
      slug: prop.slug,
      listing_price: prop.listing_price ? Number(prop.listing_price) : null,
      city: prop.city,
      zone: prop.zone,
      bedrooms: specs?.bedrooms ?? null,
      area_util: specs?.area_util ?? null,
    }
    const messageText = customMessage?.trim() || buildMessage(propForMessage)

    // 2) Resolve user's primary WhatsApp instance (active + connected)
    const { data: instance } = await admin
      .from('auto_wpp_instances')
      .select('id, user_id, status, connection_status')
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .eq('connection_status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!instance) {
      return NextResponse.json(
        { error: 'Sem instância WhatsApp conectada. Liga uma instância em Definições.' },
        { status: 400 }
      )
    }

    // 3) Load negocios + leads
    const { data: negocios, error: negErr } = await admin
      .from('negocios')
      .select(
        `id, lead_id,
         lead:leads!inner(id, nome, telemovel)`
      )
      .in('id', negocio_ids)

    if (negErr) {
      return NextResponse.json({ error: negErr.message }, { status: 500 })
    }

    const results: Array<{
      negocio_id: string
      ok: boolean
      error?: string
      sent_at?: string
    }> = []

    const nowIso = new Date().toISOString()

    // 4) Per-negocio: send + upsert + activity
    for (const neg of negocios ?? []) {
      const phone: string | null = neg.lead?.telemovel ?? null
      if (!phone) {
        results.push({ negocio_id: neg.id, ok: false, error: 'Sem telemóvel' })
        continue
      }

      try {
        const chat = await resolveChat(
          admin,
          instance.id,
          phone,
          neg.lead?.nome ?? ''
        )
        if (!chat) throw new Error('Não foi possível resolver o chat')

        await callEdge({
          action: 'send_text',
          instance_id: instance.id,
          wa_chat_id: chat.waChatId,
          text: messageText,
        })

        // Upsert negocio_properties (one row per negocio + property)
        const { data: existing } = await admin
          .from('negocio_properties')
          .select('id')
          .eq('negocio_id', neg.id)
          .eq('property_id', propertyId)
          .maybeSingle()

        if (existing?.id) {
          await admin
            .from('negocio_properties')
            .update({ status: 'sent', sent_at: nowIso, updated_at: nowIso })
            .eq('id', existing.id)
        } else {
          await admin.from('negocio_properties').insert({
            negocio_id: neg.id,
            property_id: propertyId,
            status: 'sent',
            sent_at: nowIso,
          })
        }

        // Activity log
        await admin.from('leads_activities').insert({
          contact_id: neg.lead_id,
          negocio_id: neg.id,
          activity_type: 'whatsapp',
          direction: 'outbound',
          subject: 'Enviou imóvel pelo WhatsApp',
          description: prop.title ?? '',
          metadata: {
            property_id: propertyId,
            property_title: prop.title,
            property_slug: prop.slug,
            channel: 'whatsapp',
          },
          created_by: auth.user.id,
        })

        results.push({ negocio_id: neg.id, ok: true, sent_at: nowIso })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        results.push({ negocio_id: neg.id, ok: false, error: msg })
      }
    }

    // 5) Audit
    try {
      await admin.from('log_audit').insert({
        user_id: auth.user.id,
        entity_type: 'property_share',
        entity_id: propertyId,
        action: 'property.share_via_whatsapp',
        new_data: {
          negocio_ids,
          instance_id: instance.id,
          results,
        },
      })
    } catch {
      // não crítico
    }

    const succeeded = results.filter((r) => r.ok).length
    return NextResponse.json({
      ok: succeeded > 0,
      attempted: results.length,
      succeeded,
      results,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[properties/share-via-whatsapp]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
