/**
 * Orquestra um "meta sync job" (public.meta_sync_jobs) em background.
 *
 * Corre o sync demorado no servidor (Coolify = Node de longa duração) fora do
 * ciclo de resposta HTTP — o route handler dispara isto fire-and-forget e
 * responde 202 imediatamente. Quando termina:
 *   - actualiza o job (status done/error + counters) → Realtime avisa a página
 *   - insere uma notification (sino) + web push para QUEM pediu (chega mesmo
 *     que o utilizador saia da página).
 *
 * Nunca lança — todos os erros viram status='error' + notificação de falha.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { callMubeInternal, resolveConnectionId } from '@/lib/mube/internal-client'
import { refreshInsightsMirror } from '@/lib/mube/insights-client'
import { sendPushToUser } from '@/lib/crm/send-push'
import { notificationService } from '@/lib/notifications/service'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabase = SupabaseClient<any, 'public', any>

export type MetaSyncKind = 'campaigns' | 'insights'

const ANALISE_META_URL = '/dashboard/analise-meta/campanhas'
const INSIGHTS_SINCE_DAYS = 30

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

interface SyncConnectionResponse {
  ad_assets?: {
    campaigns?: { fetched: number; upserted: number; errors: number }
    ads?: { fetched: number; upserted: number; errors: number }
  }
}

/**
 * Executa o trabalho do job e fecha-o. Idempotência não é garantida — assume-se
 * 1 job = 1 execução (criado pelo route handler).
 */
export async function runMetaSyncJob(
  db: AdminSupabase,
  jobId: string,
  kind: MetaSyncKind,
  userId: string,
): Promise<void> {
  try {
    let counters: Record<string, unknown> = {}

    if (kind === 'campaigns') {
      const connectionId = await resolveConnectionId()
      if (!connectionId) throw new Error('no_active_connection')

      const res = await callMubeInternal<SyncConnectionResponse>(
        `/api/internal/sync/connection/${connectionId}`,
        { method: 'POST', body: JSON.stringify({ since_days: 7 }) },
      )
      if (!res.ok) throw new Error(res.error)

      counters = {
        campaigns: res.data.ad_assets?.campaigns ?? null,
        ads: res.data.ad_assets?.ads ?? null,
      }
    } else {
      // insights: força re-pull do Graph na meta-api e espelha localmente.
      await callMubeInternal('/api/internal/sync/insights', {
        method: 'POST',
        body: JSON.stringify({ since_days: INSIGHTS_SINCE_DAYS }),
      })

      const to = new Date()
      const from = new Date(to.getTime() - INSIGHTS_SINCE_DAYS * 24 * 60 * 60 * 1000)
      const r = await refreshInsightsMirror(db, { from: ymd(from), to: ymd(to) })
      if (!r.ok && r.fetched === 0) throw new Error('insights_refresh_failed')
      counters = { fetched: r.fetched, upserted: r.upserted, errors: r.errors }
    }

    await db
      .from('meta_sync_jobs')
      .update({
        status: 'done',
        counters,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    await notify(db, userId, jobId, kind, 'done', counters)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[meta-sync-job] failed', { jobId, kind, message })

    await db
      .from('meta_sync_jobs')
      .update({
        status: 'error',
        error: message,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    await notify(db, userId, jobId, kind, 'error')
  }
}

async function notify(
  db: AdminSupabase,
  userId: string,
  jobId: string,
  kind: MetaSyncKind,
  outcome: 'done' | 'error',
  counters?: Record<string, unknown>,
): Promise<void> {
  const label = kind === 'campaigns' ? 'Campanhas e anúncios' : 'Desempenho (insights)'

  let title: string
  let body: string
  if (outcome === 'done') {
    title = `${label} actualizados`
    body =
      kind === 'insights'
        ? `${(counters?.upserted as number) ?? 0} linha(s) de desempenho actualizadas.`
        : 'Os dados mais recentes já estão disponíveis em Análise Meta.'
  } else {
    title = `Falha a actualizar ${label.toLowerCase()}`
    body = 'A sincronização não terminou. Tenta novamente mais tarde.'
  }

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
      metadata: { kind, outcome, counters: counters ?? null },
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
      tag: `meta-sync-${kind}`,
    })
  } catch {
    /* best-effort */
  }
}
