/**
 * POST /api/scheduler/run-bulk-sends
 *
 * Drains the `bulk_send_jobs` queue. Designed to be hit by an external
 * cron every ~30-60 s — pulls a small batch of due jobs, transitions
 * each pending → running with a guarded UPDATE (so two concurrent
 * workers can't double-execute), forwards to the matching single-target
 * synchronous endpoint, then marks done / failed.
 *
 *   • kind = 'send_properties' → POST /api/negocios/[negocio_id]/properties/send
 *   • kind = 'send_message'    → POST /api/crm/contacts/dispatch-message
 *
 * Both forwards carry the SUPABASE_SERVICE_ROLE_KEY bearer + the
 * X-Worker-User-Id header, which the modified `requireAuth` honours so
 * the downstream endpoints run with the original creator's identity
 * (correct activity-log rows, correct WhatsApp instance ownership
 * checks, etc.).
 *
 * Auth on this endpoint itself: caller must present the same service
 * key (no UI ever calls this — only cron).
 *
 * Tunable query params:
 *   ?limit=N     (default 5)   — max jobs per tick
 *   ?dry_run=1                  — list what WOULD run, don't execute
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

interface JobRow {
  id: string
  kind: string
  payload: any
  created_by: string | null
  attempts: number
  scheduled_at: string
}

interface RunResult {
  job_id: string
  ok: boolean
  status: number | null
  error?: string
}

export async function POST(request: Request) {
  try {
    // ── Worker auth — same key the worker forwards downstream ──────────
    if (!SERVICE_KEY) {
      return NextResponse.json({ error: 'Worker key not configured' }, { status: 500 })
    }
    const authHeader = request.headers.get('authorization') ?? ''
    if (authHeader !== `Bearer ${SERVICE_KEY}`) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 5))
    const dryRun = url.searchParams.get('dry_run') === '1'

    const admin = createAdminClient() as any
    const reqUrl = new URL(request.url)
    const base = `${reqUrl.protocol}//${reqUrl.host}`

    // ── Pull due jobs ──────────────────────────────────────────────────
    // Order by scheduled_at so old jobs win on ties (FIFO inside the
    // due window). The status='pending' filter + guarded UPDATE below
    // is what makes the dequeue safe under concurrent workers.
    const { data: candidates, error: pullErr } = await admin
      .from('bulk_send_jobs')
      .select('id, kind, payload, created_by, attempts, scheduled_at')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(limit)

    if (pullErr) {
      return NextResponse.json({ error: pullErr.message }, { status: 500 })
    }
    const jobs = (candidates ?? []) as JobRow[]

    if (dryRun) {
      return NextResponse.json({
        would_run: jobs.length,
        jobs: jobs.map((j) => ({ id: j.id, kind: j.kind, scheduled_at: j.scheduled_at })),
      })
    }

    const results: RunResult[] = []

    for (const job of jobs) {
      // Atomic claim — only proceed if WE flip pending → running.
      const { data: claimed, error: claimErr } = await admin
        .from('bulk_send_jobs')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1,
        })
        .eq('id', job.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (claimErr || !claimed) {
        // Another worker already grabbed it — skip silently.
        continue
      }

      let ok = false
      let status: number | null = null
      let errorMessage: string | undefined
      let resultPayload: any = null

      try {
        if (!job.created_by) throw new Error('Job sem creator')

        let targetUrl = ''
        let body: any = null
        if (job.kind === 'send_properties') {
          const negocioId = job.payload?.negocio_id
          if (!negocioId) throw new Error('Payload sem negocio_id')
          targetUrl = `${base}/api/negocios/${encodeURIComponent(negocioId)}/properties/send`
          // forward.property_ids is the property list to seed; the
          // downstream endpoint already does dossier insert + send.
          body = job.payload?.forward
        } else if (job.kind === 'send_message') {
          targetUrl = `${base}/api/crm/contacts/dispatch-message`
          body = job.payload?.dispatch
        } else {
          throw new Error(`Kind desconhecido: ${job.kind}`)
        }

        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_KEY}`,
            'X-Worker-User-Id': job.created_by,
          },
          body: JSON.stringify(body ?? {}),
        })
        status = res.status
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(json?.error?.message ?? json?.error ?? `HTTP ${res.status}`)
        }
        ok = true
        resultPayload = json
      } catch (e) {
        ok = false
        errorMessage = e instanceof Error ? e.message : 'Erro desconhecido'
      }

      // Mark final state. We don't auto-retry — the caller can re-queue
      // if needed (the original creator can see failures via the future
      // "Envios agendados" UI).
      await admin
        .from('bulk_send_jobs')
        .update({
          status: ok ? 'done' : 'failed',
          completed_at: new Date().toISOString(),
          result: resultPayload,
          error_message: errorMessage ?? null,
        })
        .eq('id', job.id)

      results.push({ job_id: job.id, ok, status, error: errorMessage })
    }

    return NextResponse.json({
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed:    results.filter((r) => !r.ok).length,
      results,
    })
  } catch (err) {
    console.error('[run-bulk-sends]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}

// Allow GET as a health-check. Returns a small status snapshot so cron
// monitoring tools can see whether the queue is healthy without
// triggering a real run.
export async function GET(request: Request) {
  if (!SERVICE_KEY) return NextResponse.json({ ok: false }, { status: 500 })
  if (request.headers.get('authorization') !== `Bearer ${SERVICE_KEY}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const admin = createAdminClient() as any
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('bulk_send_jobs')
    .select('status, scheduled_at')
    .in('status', ['pending', 'running'])
    .order('scheduled_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const due = (data ?? []).filter((r: any) => r.scheduled_at <= now).length
  const future = (data ?? []).length - due
  return NextResponse.json({ now, due, future })
}
