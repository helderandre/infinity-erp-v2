/**
 * POST /api/integrations/meta/sync-jobs
 *
 * Dispara um sync da meta-api (campanhas/anúncios OU insights) como JOB
 * assíncrono, sem bloquear o cliente. Cria uma row em public.meta_sync_jobs
 * (status='running'), arranca o trabalho fire-and-forget no servidor e responde
 * 202 com o job_id imediatamente.
 *
 * O cliente subscreve o job via Realtime (RLS por requested_by) para auto-
 * refrescar a página quando terminar; e o sino global recebe a notificação
 * (sobrevive à navegação). Ver lib/mube/run-sync-job.ts.
 *
 * Funciona porque o ERP corre num servidor Node persistente (Coolify) — a
 * promise solta continua a executar depois de devolvermos a resposta. NÃO é
 * seguro em runtimes serverless (a função seria terminada).
 *
 * Auth: sessão Supabase + permissão `settings`.
 */

import { NextRequest, NextResponse } from 'next/server'

import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { runMetaSyncJob, type MetaSyncKind } from '@/lib/mube/run-sync-job'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_KINDS: MetaSyncKind[] = ['campaigns', 'insights']

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

  let body: { kind?: unknown }
  try {
    body = (await req.json()) as { kind?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const kind = body.kind
  if (kind !== 'campaigns' && kind !== 'insights') {
    return NextResponse.json(
      { error: 'invalid_kind', valid: VALID_KINDS },
      { status: 400 },
    )
  }

  const db = createCrmAdminClient()
  const { data, error } = await db
    .from('meta_sync_jobs')
    .insert({ kind, status: 'running', requested_by: user.id })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[sync-jobs] failed to create job', { err: error })
    return NextResponse.json({ error: 'job_create_failed' }, { status: 500 })
  }

  const jobId = (data as { id: string }).id

  // Fire-and-forget — corre depois da resposta (servidor Node persistente).
  void runMetaSyncJob(db, jobId, kind, user.id).catch((err) => {
    console.error('[sync-jobs] uncaught job error', { jobId, err })
  })

  return NextResponse.json({ job_id: jobId }, { status: 202 })
}
