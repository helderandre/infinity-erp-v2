/**
 * Orquestra um "meta sync job" (public.meta_sync_jobs) em background.
 *
 * Corre o sync (possivelmente demorado) no servidor (Coolify = Node de longa
 * duração) fora do ciclo de resposta HTTP — o route handler dispara isto
 * fire-and-forget e responde 202 imediatamente. Quando termina:
 *   - actualiza o job (status done/error + counters) → Realtime avisa a página
 *   - insere uma notification (sino) + web push para QUEM pediu (chega mesmo
 *     que o utilizador saia da página).
 *
 * O sync da meta-api é ASSÍNCRONO: POST /sync/connection devolve 202 + job_id
 * e nós fazemos polling a GET /sync/jobs/{job_id} até concluir. Os recursos
 * (campanhas/anúncios/criativos/formulários/leads) chegam ao nosso mirror pelos
 * webhooks; `insights` é puxado explicitamente via refreshInsightsMirror.
 *
 * Nunca lança — todos os erros viram status='error' + notificação de falha.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  callMubeInternal,
  pollSyncJob,
  resolveConnectionId,
  type SyncResource,
} from '@/lib/mube/internal-client'
import { refreshInsightsMirror } from '@/lib/mube/insights-client'
import { sendPushToUser } from '@/lib/crm/send-push'
import { notificationService } from '@/lib/notifications/service'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabase = SupabaseClient<any, 'public', any>

const ANALISE_META_URL = '/dashboard/analise-meta/campanhas'

const RESOURCE_LABELS: Record<SyncResource, string> = {
  forms: 'Formulários',
  campaigns: 'Campanhas',
  ads: 'Anúncios',
  creatives: 'Criativos',
  leads: 'Leads',
  insights: 'Desempenho',
}

// "Todo o período": data-piso suficientemente antiga para apanhar todo o
// histórico disponível (a meta-api/Meta limitam o que devolvem na prática).
const ALL_SINCE = '2015-01-01'

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function labelFor(resources: SyncResource[]): string {
  const names = resources.map((r) => RESOURCE_LABELS[r] ?? r)
  if (names.length === 0) return 'Dados Meta'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

/**
 * Executa o trabalho do job e fecha-o. 1 job = 1 execução (criado pelo route
 * handler com a lista de recursos + período escolhidos pelo utilizador).
 */
export async function runMetaSyncJob(
  db: AdminSupabase,
  jobId: string,
  resources: SyncResource[],
  since: string | null,
  userId: string,
): Promise<void> {
  try {
    const connectionId = await resolveConnectionId()
    if (!connectionId) throw new Error('no_active_connection')

    // `since` é uma data YYYY-MM-DD; null = todo o período (data-piso).
    const sinceParam = since ?? ALL_SINCE

    // 1. Dispara o sync assíncrono na meta-api.
    const requestBody = { resources, since: sinceParam, async: true }
    console.info('[meta-sync-job] → POST /api/internal/sync/connection', {
      jobId,
      connectionId,
      body: requestBody,
    })
    const start = await callMubeInternal<{ job_id?: string; status?: string } & Record<string, unknown>>(
      `/api/internal/sync/connection/${connectionId}`,
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      },
    )
    if (!start.ok) throw new Error(start.error)
    console.info('[meta-sync-job] ← sync/connection response', { jobId, data: start.data })

    // 2. Espera concluir (async → job_id + polling). Se a meta-api tiver corrido
    //    inline e devolvido contadores directamente, usa-os.
    let counters: Record<string, unknown> = {}
    const metaJobId = start.data.job_id
    if (metaJobId) {
      console.info('[meta-sync-job] polling meta job', { jobId, metaJobId })
      const polled = await pollSyncJob(metaJobId)
      if (!polled.ok) throw new Error(polled.error)
      counters = polled.job.result ?? {}
      console.info('[meta-sync-job] meta job finished', {
        jobId,
        metaJobId,
        status: polled.job.status,
      })
    } else {
      counters = start.data
    }

    // 3. Insights chegam por leitura explícita (os outros vêm por webhook).
    if (resources.includes('insights')) {
      const mirror = await refreshInsightsMirror(db, {
        from: sinceParam,
        to: ymd(new Date()),
      })
      counters = { ...counters, insights_mirror: mirror }
    }

    await db
      .from('meta_sync_jobs')
      .update({
        status: 'done',
        counters,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    console.info('[meta-sync-job] done', { jobId, resources, counters })
    await notify(db, userId, jobId, resources, 'done')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[meta-sync-job] failed', { jobId, resources, message })

    await db
      .from('meta_sync_jobs')
      .update({
        status: 'error',
        error: message,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    await notify(db, userId, jobId, resources, 'error')
  }
}

async function notify(
  db: AdminSupabase,
  userId: string,
  jobId: string,
  resources: SyncResource[],
  outcome: 'done' | 'error',
): Promise<void> {
  const label = labelFor(resources)
  const title =
    outcome === 'done'
      ? `${label} ${resources.length === 1 ? 'actualizado' : 'actualizados'}`
      : `Falha a sincronizar ${label.toLowerCase()}`
  const body =
    outcome === 'done'
      ? 'Os dados mais recentes já estão disponíveis em Análise Meta.'
      : 'A sincronização não terminou. Tenta novamente mais tarde.'

  // Bell (sobrevive à navegação — subscrição global em useNotifications).
  try {
    await notificationService.create({
      recipientId: userId,
      notificationType: outcome === 'done' ? 'meta_sync_completed' : 'meta_sync_failed',
      entityType: 'meta_sync',
      entityId: jobId,
      title,
      body,
      actionUrl: ANALISE_META_URL,
      metadata: { resources, outcome },
    })
  } catch (err) {
    console.error('[meta-sync-job] notification insert failed', { jobId, err })
  }

  // Web push (app fechada). Best-effort.
  try {
    await sendPushToUser(db, userId, {
      title,
      body,
      url: ANALISE_META_URL,
      tag: `meta-sync-${jobId}`,
    })
  } catch {
    /* best-effort */
  }
}
