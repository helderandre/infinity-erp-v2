/**
 * Cliente server-side para os endpoints admin /api/internal/* da meta-api
 * (autenticados com X-Admin-Secret). O segredo NUNCA toca o browser — só é
 * usado a partir de server actions / route handlers.
 *
 * Espelha o callMubeInternal de app/dashboard/integracoes/meta/scope/actions.ts,
 * mas partilhável por outras superfícies (sync de campanhas/anúncios, insights).
 */

import { signMubeRequest } from '@/lib/mube/signature'

export type InternalResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

/** Recursos sincronizáveis no /api/internal/sync/connection. */
export type SyncResource =
  | 'forms'
  | 'campaigns'
  | 'ads'
  | 'creatives'
  | 'leads'
  | 'insights'

export const SYNC_RESOURCES: SyncResource[] = [
  'forms',
  'campaigns',
  'ads',
  'creatives',
  'leads',
  'insights',
]

/** Estado de um job assíncrono de sync (GET /api/internal/sync/jobs/{id}). */
export interface SyncJob {
  id: string
  connection_id: string
  tenant_id: string
  resources: string[]
  since: string | null
  status: 'pending' | 'running' | 'done' | 'failed'
  result: Record<string, unknown> | null
  error: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

/**
 * Chama um endpoint /api/internal/* da meta-api com X-Admin-Secret.
 */
export async function callMubeInternal<T>(
  path: string,
  init?: RequestInit,
): Promise<InternalResult<T>> {
  const base = process.env.MUBE_API_BASE_URL
  const secret = process.env.MUBE_ADMIN_SECRET
  if (!base || !secret) {
    console.error('[mube-internal] missing envs', {
      hasBase: !!base,
      hasSecret: !!secret,
    })
    return { ok: false, error: 'server_misconfigured' }
  }

  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'X-Admin-Secret': secret,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      // Sync síncrono pode demorar (várias chamadas Graph).
      signal: AbortSignal.timeout(60_000),
      cache: 'no-store',
    })

    const body = await res.json().catch(() => ({}) as Record<string, unknown>)

    if (!res.ok) {
      const errCode =
        typeof body?.error === 'string' ? body.error : `upstream_${res.status}`
      return { ok: false, error: errCode, status: res.status }
    }

    return { ok: true, data: body as T }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fetch_failed'
    console.error('[mube-internal] fetch threw', { path, message })
    return { ok: false, error: message }
  }
}

/**
 * Descobre o connection_id activo do tenant via GET /api/integrations/meta/connection
 * (tenant-facing, HMAC). Necessário para o sync de campanhas/anúncios
 * (POST /api/internal/sync/connection/{connection_id}).
 *
 * Mesmo padrão do goToScopePicker em integracoes/meta/actions.ts.
 */
export async function resolveConnectionId(): Promise<string | null> {
  const base = process.env.MUBE_API_BASE_URL
  const tenantId = process.env.MUBE_TENANT_ID
  const signingSecret = process.env.MUBE_SIGNING_SECRET
  if (!base || !tenantId || !signingSecret) {
    console.error('[mube-internal] resolveConnectionId missing envs')
    return null
  }

  const pathWithQuery = `/api/integrations/meta/connection?tenant_id=${tenantId}`
  const { timestamp, signature } = signMubeRequest({
    method: 'GET',
    pathWithQuery,
    body: '',
    secret: signingSecret,
  })

  try {
    const res = await fetch(`${base}${pathWithQuery}`, {
      method: 'GET',
      headers: {
        'X-Mube-Tenant-Id': tenantId,
        'X-Mube-Timestamp': timestamp,
        'X-Mube-Signature-256': signature,
      },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[mube-internal] /connection non-2xx', { status: res.status })
      return null
    }
    const body = (await res.json()) as {
      connected: boolean
      connection: { id?: string } | null
    }
    return body?.connection?.id ?? null
  } catch (err) {
    console.error('[mube-internal] /connection fetch threw', {
      err: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/**
 * GET /api/internal/sync/jobs/{job_id} — estado de um job assíncrono de sync.
 */
export async function getSyncJob(jobId: string): Promise<InternalResult<SyncJob>> {
  const res = await callMubeInternal<{ job: SyncJob }>(
    `/api/internal/sync/jobs/${jobId}`,
  )
  if (!res.ok) return res
  return { ok: true, data: res.data.job }
}

/**
 * Faz polling a getSyncJob até `done`/`failed` (ou timeout). Devolve o job
 * final. Corre em background (server) — interval generoso para não martelar.
 */
export async function pollSyncJob(
  jobId: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<{ ok: true; job: SyncJob } | { ok: false; error: string }> {
  const intervalMs = opts?.intervalMs ?? 5_000
  const timeoutMs = opts?.timeoutMs ?? 14 * 60 * 1000
  const deadline = Date.now() + timeoutMs

  // pequeno atraso inicial — o job acabou de ser enfileirado
  await sleep(2_000)

  while (Date.now() < deadline) {
    const res = await getSyncJob(jobId)
    if (!res.ok) {
      // 404/erro transitório — tenta mais umas vezes antes de desistir
      await sleep(intervalMs)
      continue
    }
    const job = res.data
    if (job.status === 'done') return { ok: true, job }
    if (job.status === 'failed') {
      return { ok: false, error: job.error ?? 'sync_job_failed' }
    }
    await sleep(intervalMs)
  }
  return { ok: false, error: 'sync_job_timeout' }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
