/**
 * POST /api/integrations/meta/disconnect
 *
 * Desliga a integração Meta no meta-api e marca a row local como `disconnected`.
 * O meta-api fica responsável por revogar tokens e remover Pages do leadgen.
 *
 * Falha do remote NÃO impede a marcação local — preferimos refletir "desligado"
 * em vez de deixar o utilizador preso no estado anterior.
 */

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const mubeApiBaseUrl = process.env.MUBE_API_BASE_URL
  if (!mubeApiBaseUrl) {
    console.error('[meta-disconnect] MUBE_API_BASE_URL not configured')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const admin = createCrmAdminClient()

  const { data: integration } = await admin
    .schema('meta')
    .from('meta_integration')
    .select('id, mube_tenant_id')
    .limit(1)
    .maybeSingle()

  if (!integration) {
    return NextResponse.json({ error: 'no_integration' }, { status: 404 })
  }

  // Chama o meta-api para revogar a conexão remota.
  let remoteError: string | null = null
  try {
    const res = await fetch(`${mubeApiBaseUrl}/api/integrations/meta/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: integration.mube_tenant_id }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      remoteError = `meta-api respondeu ${res.status}: ${text.slice(0, 200)}`
      console.warn('[meta-disconnect] Remote disconnect failed', {
        status: res.status,
        body: text.slice(0, 500),
      })
    }
  } catch (err) {
    remoteError = err instanceof Error ? err.message : 'fetch_failed'
    console.error('[meta-disconnect] Remote disconnect threw', { err })
  }

  // Marca local como disconnected mesmo se o remote falhou.
  const { error: updateErr } = await admin
    .schema('meta')
    .from('meta_integration')
    .update({
      status: 'disconnected',
      connected_at: null,
      last_error: remoteError,
    })
    .eq('id', integration.id)

  if (updateErr) {
    console.error('[meta-disconnect] Failed to update local state', { updateErr })
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, remote_error: remoteError })
}
