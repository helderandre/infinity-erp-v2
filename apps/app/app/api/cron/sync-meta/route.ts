import { NextResponse } from 'next/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { runMetaGraphSync } from '@/lib/meta/graph-sync'
import type { SyncResource } from '@/hooks/use-meta-sync-job'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cron — sincronização Meta agendada via Graph API (app Meta).
 *
 * Pensado para 2×/dia (08:00 e 20:00 PT) via Coolify Scheduled Task, para
 * espalhar a carga no VPS em vez de syncs manuais ad-hoc. Corre o mesmo
 * caminho do botão "Sincronizar" da Análise → Meta (runMetaGraphSync), mas
 * sem utilizador associado (sem notificação per-user).
 *
 * Auth: GET /api/cron/sync-meta?key=<CRON_SECRET>
 *
 * Coolify (curl não existe no container — usar wget, ver memory coolify_no_curl):
 *   wget -qO- "https://app.infinitygroup.pt/api/cron/sync-meta?key=$CRON_SECRET"
 *   Cron: `0 7,19 * * *`  (07:00 e 19:00 UTC = 08:00 e 20:00 PT no horário de verão)
 */

const RESOURCES: SyncResource[] = ['campaigns', 'ads', 'leads', 'insights']

/**
 * Conta Meta direta (Graph API, act_24368990092726847, env META_ACCESS_TOKEN/
 * META_AD_ACCOUNT_ID) DESLIGADA por decisão do stakeholder (2026-06-30) — trazia
 * leads de recrutamento de agentes ("[COLD] Lead Gen") que não queremos no CRM.
 * Esta conta é separada da ligação federada (MUBE/Filipe, via webhooks). Para
 * reactivar, pôr a true. Ver memory project_meta_direct_account_disconnected.
 */
const DIRECT_META_SYNC_ENABLED = false

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && key !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!DIRECT_META_SYNC_ENABLED) {
      return NextResponse.json(
        { ok: true, disabled: true, reason: 'direct_meta_account_disconnected' },
        { status: 200 },
      )
    }

    const db = createCrmAdminClient()
    const { data, error } = await db
      .from('meta_sync_jobs')
      .insert({ status: 'running', requested_by: null, resources: RESOURCES, since: null })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[cron/sync-meta] failed to create job', { err: error })
      return NextResponse.json({ error: 'job_create_failed' }, { status: 500 })
    }

    const jobId = (data as { id: string }).id

    // Fire-and-forget — corre depois da resposta (servidor Node persistente,
    // Coolify). O wget do cron recebe o 202 de imediato; o sync continua.
    void runMetaGraphSync(db, jobId, RESOURCES, null).catch((err) => {
      console.error('[cron/sync-meta] uncaught job error', { jobId, err })
    })

    return NextResponse.json({ ok: true, job_id: jobId }, { status: 202 })
  } catch (err) {
    console.error('[cron/sync-meta] error', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
