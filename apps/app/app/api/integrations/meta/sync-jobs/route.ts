/**
 * POST /api/integrations/meta/sync-jobs
 *
 * Dispara um sync da meta-api como JOB assíncrono, sem bloquear o cliente.
 * Body: { resources: SyncResource[], since?: string }. `since` é uma data
 * YYYY-MM-DD (null/ausente = todo o período). Cria uma row em
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
import { runMetaGraphSync } from '@/lib/meta/graph-sync'
import { SYNC_RESOURCES, type SyncResource } from '@/lib/mube/internal-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SINCE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Sync directo via Graph API (botão "Sincronizar" da Análise → Meta) usa a conta
 * Meta directa (act_24368990092726847), DESLIGADA por decisão do stakeholder
 * (2026-06-30). Separada da ligação federada MUBE/Filipe. Pôr a true para
 * reactivar. Ver memory project_meta_direct_account_disconnected.
 */
const DIRECT_META_SYNC_ENABLED = false

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

  if (!DIRECT_META_SYNC_ENABLED) {
    return NextResponse.json(
      { error: 'direct_meta_account_disconnected', disabled: true },
      { status: 409 },
    )
  }

  let body: { resources?: unknown; since?: unknown }
  try {
    body = (await req.json()) as { resources?: unknown; since?: unknown }
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

  // `since` é uma data YYYY-MM-DD; null/ausente = "todo o período".
  let since: string | null = null
  if (body.since != null && body.since !== '') {
    if (typeof body.since !== 'string' || !SINCE_RE.test(body.since)) {
      return NextResponse.json({ error: 'invalid_since' }, { status: 400 })
    }
    since = body.since
  }

  const db = createCrmAdminClient()
  const { data, error } = await db
    .from('meta_sync_jobs')
    .insert({
      status: 'running',
      requested_by: user.id,
      resources,
      since,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[sync-jobs] failed to create job', { err: error })
    return NextResponse.json({ error: 'job_create_failed' }, { status: 500 })
  }

  const jobId = (data as { id: string }).id

  // Fire-and-forget — corre depois da resposta (servidor Node persistente).
  // Sync via Graph API directa (app Meta), em substituição do caminho mube.
  void runMetaGraphSync(db, jobId, resources, user.id).catch((err) => {
    console.error('[sync-jobs] uncaught job error', { jobId, err })
  })

  return NextResponse.json({ job_id: jobId }, { status: 202 })
}
