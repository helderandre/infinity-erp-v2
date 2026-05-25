/**
 * POST /api/integrations/meta/sync
 *
 * Endpoint server-side que assina e proxia o pedido para o meta-api
 * (POST /api/integrations/meta/replay). O signing secret nunca toca o browser.
 *
 * Fluxo:
 *   1. Valida sessão do utilizador (cookie client)
 *   2. Valida `since_days` (inteiro 1..90)
 *   3. Lê MUBE_TENANT_ID + MUBE_SIGNING_SECRET + MUBE_API_BASE_URL do ambiente
 *   4. Constrói body { tenant_id, since_days } + assina com HMAC
 *      (mensagem canónica = ts.POST.<path>.<body>)
 *   5. POST para meta-api; devolve a resposta tal como está (202 + job_id, etc.)
 *
 * O meta-api processa em background — esta rota responde 202 imediatamente.
 * Os webhooks (form.synced / campaign.synced / ad.synced / lead.created) chegam
 * em paralelo a /api/webhooks/mube/events à medida que cada etapa termina.
 */

import { NextRequest, NextResponse } from 'next/server'

import { signMubeRequest } from '@/lib/mube/signature'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REPLAY_PATH = '/api/integrations/meta/replay'

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // 2. Body
  let body: { since_days?: unknown }
  try {
    body = (await req.json()) as { since_days?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const sinceDays = body.since_days
  if (
    typeof sinceDays !== 'number' ||
    !Number.isInteger(sinceDays) ||
    sinceDays < 1 ||
    sinceDays > 90
  ) {
    return NextResponse.json(
      {
        error: 'since_days_invalid',
        message: 'since_days deve ser inteiro entre 1 e 90.',
      },
      { status: 400 },
    )
  }

  // 3. Env
  const mubeApiBaseUrl = process.env.MUBE_API_BASE_URL
  const tenantId = process.env.MUBE_TENANT_ID
  const signingSecret = process.env.MUBE_SIGNING_SECRET
  if (!mubeApiBaseUrl || !tenantId || !signingSecret) {
    console.error('[meta-sync] Missing env vars', {
      mubeApiBaseUrl: !!mubeApiBaseUrl,
      tenantId: !!tenantId,
      signingSecret: !!signingSecret,
    })
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  // 4. Body upstream + assinatura
  const upstreamBody = JSON.stringify({
    tenant_id: tenantId,
    since_days: sinceDays,
  })
  const { timestamp, signature } = signMubeRequest({
    method: 'POST',
    pathWithQuery: REPLAY_PATH,
    body: upstreamBody,
    secret: signingSecret,
  })

  // 5. Chama meta-api
  try {
    const upstream = await fetch(`${mubeApiBaseUrl}${REPLAY_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mube-Tenant-Id': tenantId,
        'X-Mube-Timestamp': timestamp,
        'X-Mube-Signature-256': signature,
      },
      body: upstreamBody,
      signal: AbortSignal.timeout(15_000),
    })

    const responseBody = (await upstream.json().catch(() => ({}))) as Record<
      string,
      unknown
    >

    if (!upstream.ok) {
      console.warn('[meta-sync] upstream non-2xx', {
        status: upstream.status,
        body: responseBody,
        userId: user.id,
        sinceDays,
      })
      // 401/403/409 vêm do meta-api e fazem sentido propagar tal como está.
      // 5xx normaliza para 502 (estamos a actuar como proxy).
      const passthroughStatus =
        upstream.status === 401 ||
        upstream.status === 403 ||
        upstream.status === 409 ||
        upstream.status === 400
          ? upstream.status
          : 502
      return NextResponse.json(
        {
          error: 'upstream_error',
          upstream_status: upstream.status,
          details: responseBody,
        },
        { status: passthroughStatus },
      )
    }

    console.info('[meta-sync] queued', {
      userId: user.id,
      sinceDays,
      jobId: responseBody?.job_id,
      connections: responseBody?.connections,
    })

    return NextResponse.json(responseBody, { status: 202 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fetch_failed'
    console.error('[meta-sync] fetch threw', { err: message })
    return NextResponse.json(
      { error: 'upstream_unreachable', message },
      { status: 502 },
    )
  }
}
