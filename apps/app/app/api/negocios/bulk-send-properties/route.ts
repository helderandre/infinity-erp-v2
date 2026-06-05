/**
 * POST /api/negocios/bulk-send-properties
 *
 * Queues a staggered bulk property send. Used by the kanban multi-select
 * "Enviar imóveis escolhidos" / "Matches rígidos" actions.
 *
 * Body shape (unchanged from the synchronous version):
 *   {
 *     targets: [{ negocio_id, property_ids: string[] }],
 *     email?:    { account_id, subject?, intro_html? },
 *     whatsapp?: { instance_id, intro_message? },
 *     stagger_seconds?: number   // optional override (default 60)
 *   }
 *
 * Behaviour:
 *   • For each target we translate the inputs once into the exact body
 *     the existing single-target send endpoint expects (body_html /
 *     message + recipients in the right shape) and store it on a job row.
 *   • Job rows are created with `scheduled_at = now() + i * stagger`,
 *     so target #0 runs immediately, target #1 a minute later, target
 *     #2 two minutes later, etc. Default stagger is 60 s — slow enough
 *     for WhatsApp not to flag the instance, fast enough that a 10-row
 *     batch is finished inside 10 minutes.
 *   • The endpoint returns immediately with `{ batch_id, queued,
 *     scheduled_first, scheduled_last }`. The worker
 *     (/api/scheduler/run-bulk-sends) drains the queue.
 *
 * Anything that previously happened inline — actual SMTP / WhatsApp
 * dispatch, dossier seed, registry writes, activity log — now happens
 * inside the worker as it pops each job. The user's request returns
 * before any of that fires, so the UI is never blocked.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const TargetSchema = z.object({
  negocio_id:   z.string().min(1),
  property_ids: z.array(z.string().min(1)).min(1).max(50),
})

const BodySchema = z.object({
  targets: z.array(TargetSchema).min(1).max(100),
  email: z
    .object({
      account_id: z.string().min(1),
      subject:    z.string().max(300).optional(),
      intro_html: z.string().max(20_000).optional(),
    })
    .optional(),
  whatsapp: z
    .object({
      instance_id:   z.string().min(1),
      intro_message: z.string().max(5_000).optional(),
    })
    .optional(),
  stagger_seconds: z.number().int().min(0).max(3600).optional(),
})

const DEFAULT_STAGGER_S = 60

// E.164 normaliser — keeps payloads valid for the underlying send endpoint.
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) {
    const c = `+${digits.slice(2)}`
    return /^\+[1-9]\d{7,14}$/.test(c) ? c : null
  }
  if (digits.length === 9 && /^[29]/.test(digits)) {
    const c = `+351${digits}`
    return /^\+[1-9]\d{7,14}$/.test(c) ? c : null
  }
  if (digits.length >= 10 && digits.length <= 15) {
    const c = `+${digits}`
    return /^\+[1-9]\d{7,14}$/.test(c) ? c : null
  }
  return null
}

const HTML_ESCAPE_RE = /[&<>"']/g
const HTML_ENTITY: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}
function escapeHtml(s: string): string {
  return s.replace(HTML_ESCAPE_RE, (c) => HTML_ENTITY[c]).replace(/\n/g, '<br/>')
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
    const { targets, email, whatsapp, stagger_seconds } = parsed.data
    if (!email && !whatsapp) {
      return NextResponse.json({ error: 'Active pelo menos um canal' }, { status: 400 })
    }

    const stagger = stagger_seconds ?? DEFAULT_STAGGER_S
    const admin = createAdminClient() as any
    const batchId = crypto.randomUUID()
    const baseTime = Date.now()
    const startedAt = new Date(baseTime).toISOString()

    // Pre-load contacts for every target so we can build recipient lists
    // at queue time (worker stays dumb and just forwards).
    const negocioIds = targets.map((t) => t.negocio_id)
    const { data: negs } = await admin
      .from('negocios')
      .select('id, lead_id, leads:lead_id(id, nome, email, telemovel)')
      .in('id', negocioIds)
    const contactByNegocio = new Map<string, { name: string; email: string | null; phone: string | null }>()
    for (const n of (negs ?? []) as any[]) {
      const lead = Array.isArray(n.leads) ? n.leads[0] : n.leads
      contactByNegocio.set(n.id, {
        name: lead?.nome ?? '',
        email: lead?.email ?? null,
        phone: lead?.telemovel ?? null,
      })
    }

    const bodyHtml = email
      ? (email.intro_html?.trim()
          ? `<p>${escapeHtml(email.intro_html)}</p>`
          : '<p>Olá, partilhamos os imóveis abaixo:</p>')
      : ''

    const jobsToInsert: any[] = []
    const skipped: { negocio_id: string; reason: string }[] = []

    targets.forEach((target, i) => {
      const contact = contactByNegocio.get(target.negocio_id)
      if (!contact) {
        skipped.push({ negocio_id: target.negocio_id, reason: 'Contacto não encontrado' })
        return
      }

      const emailRecipients =
        email && contact.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)
          ? [contact.email]
          : []
      const wppRecipients = (() => {
        if (!whatsapp) return [] as string[]
        const e164 = toE164(contact.phone)
        return e164 ? [e164] : []
      })()

      if (
        (!email || emailRecipients.length === 0) &&
        (!whatsapp || wppRecipients.length === 0)
      ) {
        const reasons: string[] = []
        if (email && emailRecipients.length === 0) reasons.push('sem email')
        if (whatsapp && wppRecipients.length === 0) reasons.push('telemóvel inválido')
        skipped.push({
          negocio_id: target.negocio_id,
          reason: `Contacto ${reasons.join(' / ') || 'sem canal disponível'}`,
        })
        return
      }

      // The body the worker will POST verbatim to the existing
      // single-target endpoint /api/negocios/[id]/properties/send.
      const forwardBody: Record<string, unknown> = {
        // negocio_property_ids will be filled after the worker seeds the
        // dossier; for now the worker reads `property_ids` and does the
        // dossier insert + id resolution itself.
        property_ids: target.property_ids,
      }
      if (email && emailRecipients.length > 0) {
        forwardBody.email = {
          account_id: email.account_id,
          subject:    (email.subject?.trim() || 'Sugestões de imóveis'),
          body_html:  bodyHtml,
          recipients: emailRecipients,
        }
      }
      if (whatsapp && wppRecipients.length > 0) {
        forwardBody.whatsapp = {
          instance_id: whatsapp.instance_id,
          message:     whatsapp.intro_message?.trim() || undefined,
          recipients:  wppRecipients,
        }
      }

      jobsToInsert.push({
        batch_id:     batchId,
        kind:         'send_properties',
        payload:      {
          negocio_id: target.negocio_id,
          forward:    forwardBody,
        },
        scheduled_at: new Date(baseTime + i * stagger * 1000).toISOString(),
        created_by:   auth.user.id,
      })
    })

    if (jobsToInsert.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum contacto com canal disponível', skipped },
        { status: 400 },
      )
    }

    const { error: insertErr } = await admin
      .from('bulk_send_jobs')
      .insert(jobsToInsert)
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    const lastTime = new Date(baseTime + (jobsToInsert.length - 1) * stagger * 1000).toISOString()

    return NextResponse.json({
      batch_id: batchId,
      queued: jobsToInsert.length,
      scheduled_first: startedAt,
      scheduled_last: lastTime,
      stagger_seconds: stagger,
      skipped,
    })
  } catch (err) {
    console.error('[bulk-send-properties]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
