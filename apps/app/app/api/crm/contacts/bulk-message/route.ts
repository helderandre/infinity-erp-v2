/**
 * POST /api/crm/contacts/bulk-message
 *
 * Queues a staggered bulk WhatsApp / Email send. Same body shape as the
 * old synchronous version (so the dialogs only had to switch toasts) —
 * the only new optional field is `stagger_seconds`, which lets the
 * caller override the default 60 s gap between contacts.
 *
 * Body shape:
 *   {
 *     targets: [{ contact_id, negocio_id? }],
 *     email?:    { account_id, subject, body_html },
 *     whatsapp?: { instance_id, message },
 *     stagger_seconds?: number   // default 60
 *   }
 *
 * One job row is created per contact. The worker
 * (/api/scheduler/run-bulk-sends) drains the queue and forwards each
 * job to /api/crm/contacts/dispatch-message — the synchronous executor
 * that holds the actual SMTP / WhatsApp call.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TargetSchema = z.object({
  contact_id: z.string().regex(UUID_RE),
  negocio_id: z.string().regex(UUID_RE).optional(),
})

const BodySchema = z.object({
  targets: z.array(TargetSchema).min(1).max(200),
  email: z.object({
    account_id: z.string().regex(UUID_RE),
    subject:    z.string().min(1).max(300),
    body_html:  z.string().min(1).max(50_000),
  }).optional(),
  whatsapp: z.object({
    instance_id: z.string().regex(UUID_RE),
    message:     z.string().min(1).max(4_000),
  }).optional(),
  stagger_seconds: z.number().int().min(0).max(3600).optional(),
}).refine((b) => !!b.email || !!b.whatsapp, {
  message: 'Active pelo menos um canal',
})

const DEFAULT_STAGGER_S = 60

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
    const stagger = stagger_seconds ?? DEFAULT_STAGGER_S
    const admin = createAdminClient() as any
    const batchId = crypto.randomUUID()
    const baseTime = Date.now()

    // Each job is a single-target call to the dispatch endpoint. The
    // payload is exactly what /dispatch-message expects so the worker
    // doesn't have to translate anything mid-flight.
    const jobs = targets.map((target, i) => {
      const dispatchBody: Record<string, unknown> = {
        targets: [target],
      }
      if (email)    dispatchBody.email    = email
      if (whatsapp) dispatchBody.whatsapp = whatsapp
      return {
        batch_id:     batchId,
        kind:         'send_message',
        payload:      { dispatch: dispatchBody },
        scheduled_at: new Date(baseTime + i * stagger * 1000).toISOString(),
        created_by:   auth.user.id,
      }
    })

    const { error: insertErr } = await admin
      .from('bulk_send_jobs')
      .insert(jobs)
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      batch_id: batchId,
      queued: jobs.length,
      scheduled_first: new Date(baseTime).toISOString(),
      scheduled_last:  new Date(baseTime + (jobs.length - 1) * stagger * 1000).toISOString(),
      stagger_seconds: stagger,
    })
  } catch (err) {
    console.error('[bulk-message]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
