/**
 * POST /api/integrations/meta/sync-jobs
 *
 * Dispara um sync da meta-api como JOB assíncrono, sem bloquear o cliente.
 * Body: { resources: SyncResource[], since_days?: number }. Cria uma row em
 * public.meta_sync_jobs (status='running'), arranca o trabalho fire-and-forget
 * no servidor e responde 202 com o job_id imediatamente.
 *
 * O cliente subscreve o job via Realtime (RLS por requested_by) para auto-
 * refrescar a página quando terminar; e o sino global recebe a notificação
 * (sobrevive à navegação). Ver lib/mube/run-sync-job.ts.
 *
 * Funciona porque o ERP corre num servidor Node persistente (Coolify) — a
 * promise solta continua a executar (e a fazer polling à meta-api) depois de
 * devolvermos a resposta. NÃO é seguro em runtimes serverless.
 *
 * Auth: sessão Supabase + permissão `settings`.
 */

import { NextRequest, NextResponse } from 'next/server'

import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { runMetaSyncJob } from '@/lib/mube/run-sync-job'
import { SYNC_RESOURCES, type SyncResource } from '@/lib/mube/internal-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clampSinceDays(value: unknown): number {
  const n = typeof value === 'number' && Number.isInteger(value) ? value : 30
  return Math.min(365, Math.max(1, n))
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const canManage = await hasPermissionServer(supabase, user.id, 'settings')
  if (!canManage) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { resources?: unknown; since_days?: unknown }
  try {
    body = (await req.json()) as { resources?: unknown; since_days?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Valida e filtra os recursos contra o enum conhecido.
  const requested = Array.isArray(body.resources) ? body.resources : []
  const resources = requested.filter(
    (r): r is SyncResource =>
      typeof r === 'string' && (SYNC_RESOURCES as string[]).includes(r),
  )
  if (resources.length === 0) {
    return NextResponse.json(
      { error: 'invalid_resources', valid: SYNC_RESOURCES },
      { status: 400 },
    )
  }
  const sinceDays = clampSinceDays(body.since_days)

  const db = createCrmAdminClient()
  const { data, error } = await db
    .from('meta_sync_jobs')
    .insert({
      status: 'running',
      requested_by: user.id,
      resources,
      since_days: sinceDays,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[sync-jobs] failed to create job', { err: error })
    return NextResponse.json({ error: 'job_create_failed' }, { status: 500 })
  }

  const jobId = (data as { id: string }).id

  // Fire-and-forget — corre depois da resposta (servidor Node persistente).
  void runMetaSyncJob(db, jobId, resources, sinceDays, user.id).catch((err) => {
    console.error('[sync-jobs] uncaught job error', { jobId, err })
  })

  return NextResponse.json({ job_id: jobId }, { status: 202 })
}
