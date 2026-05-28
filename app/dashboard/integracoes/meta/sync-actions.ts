'use server'

import { revalidatePath } from 'next/cache'

import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { refreshInsightsMirror } from '@/lib/mube/insights-client'
import {
  callMubeInternal,
  resolveConnectionId,
  type InternalResult,
} from '@/lib/mube/internal-client'
import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

// ── Response shapes (subset) dos endpoints /api/internal/* ──────────────────

export interface SyncInsightsResponse {
  connections_processed: number
  since_days: number
  total_errors: number
  purged?: boolean
  elapsed_ms: number
}

export interface DeliverInsightsResponse {
  tenant_id: string
  ad_account_ids: string[]
  dry_run: boolean
  since_days: number
  found: number
  delivered: number
  errors?: number
  elapsed_ms: number
  note?: string
}

export interface SyncConnectionResponse {
  connection_id: string
  pages?: number
  forms_total?: { fetched: number; upserted: number; errors: number }
  leads_total?: { fetched: number; upserted: number; errors: number; forms_processed: number }
  ad_assets?: {
    accounts?: Record<string, number>
    campaigns?: { fetched: number; upserted: number; errors: number }
    ads?: { fetched: number; upserted: number; errors: number }
  }
  elapsed_ms: number
}

// ── Guard partilhado: utilizador autenticado + permissão `settings` ─────────

async function requireAdminUser(): Promise<
  { ok: true; userId: string } | { ok: false; error: string; status: number }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated', status: 401 }

  const has = await hasPermissionServer(supabase, user.id, 'settings')
  if (!has) return { ok: false, error: 'forbidden', status: 403 }

  return { ok: true, userId: user.id }
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function clampSinceDays(value: unknown, fallback = 30): number {
  const n = typeof value === 'number' && Number.isInteger(value) ? value : fallback
  return Math.min(90, Math.max(1, n))
}

// ── B.1 POST /api/internal/sync/insights ────────────────────────────────────

/**
 * Força um refresh dos insights na meta-api (re-pull Graph + upsert na BD dela).
 * NÃO traz métricas para o nosso lado — o meta-api emite depois `insights.synced`.
 * Para popular o mirror local imediatamente, usa refreshPerformanceNow().
 */
export async function syncInsights(opts?: {
  since_days?: number
}): Promise<InternalResult<SyncInsightsResponse>> {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth

  return callMubeInternal<SyncInsightsResponse>('/api/internal/sync/insights', {
    method: 'POST',
    body: JSON.stringify({ since_days: clampSinceDays(opts?.since_days) }),
  })
}

// ── B.2 POST /api/internal/deliver-insights ─────────────────────────────────

/**
 * Re-entrega os insights de ESTE tenant via webhook (insights.synced). Útil
 * quando se quer forçar o ciclo de entrega sem re-pull do Graph.
 */
export async function deliverInsights(opts?: {
  ad_account_id?: string
  since_days?: number
  dry_run?: boolean
}): Promise<InternalResult<DeliverInsightsResponse>> {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth

  const tenantId = process.env.MUBE_TENANT_ID
  if (!tenantId) return { ok: false, error: 'server_misconfigured' }

  return callMubeInternal<DeliverInsightsResponse>('/api/internal/deliver-insights', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: tenantId,
      ...(opts?.ad_account_id ? { ad_account_id: opts.ad_account_id } : {}),
      since_days: clampSinceDays(opts?.since_days),
      ...(opts?.dry_run ? { dry_run: true } : {}),
    }),
  })
}

// ── B.3 POST /api/internal/sync/connection/{connection_id} ──────────────────

/**
 * Re-sincroniza TUDO de uma connection (formulários, leads, ad accounts,
 * campanhas, anúncios). Síncrono na meta-api; os webhooks campaign.synced/
 * ad.synced chegam em paralelo e populam o mirror local. Descobre campanhas/
 * anúncios novos (o Meta não envia webhook na criação).
 */
export async function syncConnection(opts?: {
  since_days?: number
}): Promise<InternalResult<SyncConnectionResponse>> {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth

  const connectionId = await resolveConnectionId()
  if (!connectionId) return { ok: false, error: 'no_active_connection' }

  const result = await callMubeInternal<SyncConnectionResponse>(
    `/api/internal/sync/connection/${connectionId}`,
    {
      method: 'POST',
      body: JSON.stringify({ since_days: clampSinceDays(opts?.since_days, 7) }),
    },
  )

  if (result.ok) {
    // Os webhooks já actualizaram (ou estão a actualizar) o mirror local.
    revalidatePath('/dashboard/analise-meta/campanhas')
    revalidatePath('/dashboard/analise-meta/ads')
  }
  return result
}

// ── Acções user-facing (botões "Atualizar agora") ──────────────────────────

/**
 * Botão "Atualizar campanhas/anúncios agora" — força o sync da connection.
 */
export async function refreshCampaignsAdsNow(): Promise<
  InternalResult<SyncConnectionResponse>
> {
  return syncConnection({ since_days: 7 })
}

/**
 * Botão "Atualizar desempenho agora":
 *   1. Força re-pull dos insights na meta-api (sync/insights).
 *   2. Puxa as linhas frescas para o mirror local (refreshInsightsMirror, HMAC).
 * Devolve quantas linhas entraram no mirror para feedback imediato.
 */
export async function refreshPerformanceNow(opts?: {
  since_days?: number
}): Promise<
  | { ok: true; fetched: number; upserted: number; errors: number }
  | { ok: false; error: string }
> {
  const auth = await requireAdminUser()
  if (!auth.ok) return { ok: false, error: auth.error }

  const sinceDays = clampSinceDays(opts?.since_days)

  // 1. Re-pull do Graph (best-effort — se falhar, ainda espelhamos o que houver).
  await syncInsights({ since_days: sinceDays })

  // 2. Mirror local da janela [hoje-sinceDays, hoje].
  const to = new Date()
  const from = new Date(to.getTime() - sinceDays * 24 * 60 * 60 * 1000)
  const db = createCrmAdminClient()
  const result = await refreshInsightsMirror(db, {
    from: ymd(from),
    to: ymd(to),
  })

  revalidatePath('/dashboard/analise-meta/campanhas')
  revalidatePath('/dashboard/analise-meta/ads')

  if (!result.ok && result.fetched === 0) {
    return { ok: false, error: 'refresh_failed' }
  }
  return {
    ok: true,
    fetched: result.fetched,
    upserted: result.upserted,
    errors: result.errors,
  }
}
