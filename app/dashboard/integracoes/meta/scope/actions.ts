'use server'

import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { createClient } from '@/lib/supabase/server'

import type {
  ActionResult,
  CommitScopePayload,
  CommitScopeResponse,
  ScopePreviewResponse,
} from './types'

/**
 * Wrapper privado para chamar endpoints `/api/internal/*` do meta-api com
 * X-Admin-Secret. Devolve ActionResult tipado para a caller (UI) destrinçar
 * sucesso vs. erro sem lançar excepções (mais simples para useTransition).
 */
async function callMubeInternal<T>(
  path: string,
  init?: RequestInit,
): Promise<ActionResult<T>> {
  const base = process.env.MUBE_API_BASE_URL
  const secret = process.env.MUBE_ADMIN_SECRET
  if (!base || !secret) {
    console.error('[scope] missing envs', {
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
      // Preview chama múltiplos endpoints Graph — pode chegar a ~10s.
      signal: AbortSignal.timeout(30_000),
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
    console.error('[scope] fetch threw', { path, message })
    return { ok: false, error: message }
  }
}

/**
 * Guard partilhado entre as duas actions: utilizador autenticado + permissão
 * `settings` (Broker/CEO ou admin role implicitamente passam).
 */
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

/**
 * GET /api/internal/scope/preview
 * Lista Pages + BMs + ad accounts visíveis para a connection + regras actuais.
 *
 * Latência: ~3-10s (faz N chamadas Graph). UI deve mostrar loading.
 */
export async function fetchScopePreview(
  connection_id: string,
  include_client: boolean,
): Promise<ActionResult<ScopePreviewResponse>> {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth

  const params = new URLSearchParams({
    connection_id,
    include_client: include_client ? 'true' : 'false',
  })
  return callMubeInternal<ScopePreviewResponse>(
    `/api/internal/scope/preview?${params.toString()}`,
  )
}

/**
 * POST /api/internal/scope/commit
 * Substitui (DELETE+INSERT atómico) as regras de scope do tenant e dispara
 * syncEverythingForConnection fire-and-forget.
 *
 * `created_by` é injectado server-side a partir da sessão (anti-spoofing —
 * cliente não consegue forjar identidade no audit log).
 */
export async function commitScope(
  payload: CommitScopePayload,
): Promise<ActionResult<CommitScopeResponse>> {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth

  const enriched: CommitScopePayload = {
    ...payload,
    created_by: auth.userId,
  }

  return callMubeInternal<CommitScopeResponse>(
    '/api/internal/scope/commit',
    {
      method: 'POST',
      body: JSON.stringify(enriched),
    },
  )
}
