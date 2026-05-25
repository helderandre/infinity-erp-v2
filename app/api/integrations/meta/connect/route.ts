/**
 * GET /api/integrations/meta/connect
 *
 * Inicia o fluxo OAuth federado com o meta-api Mube. Marca a integração como
 * `connecting`, regista quem clicou e redireciona para o meta-api, que por sua
 * vez abre o consent screen do Facebook e devolve para
 * /dashboard/integracoes/meta/callback.
 *
 * Auth da sessão: cookie client (utilizador autenticado no ERP).
 * Mutação na tabela meta.meta_integration: admin client (cookie client não tem
 * grants no schema meta — só service_role tem).
 */

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Detecta se o request é um prefetch (Next.js Link, Chrome speculation rules,
 * crawler agressivo, etc.) e rejeita silenciosamente com 204 — caso contrário
 * o GET com side-effect (escrever `connecting` na DB) é disparado sozinho
 * sempre que a página renderiza o Link.
 */
function isPrefetch(req: NextRequest): boolean {
  if (req.headers.get('next-router-prefetch') === '1') return true
  if (req.headers.get('purpose') === 'prefetch') return true
  const secPurpose = req.headers.get('sec-purpose')
  if (secPurpose && secPurpose.includes('prefetch')) return true
  return false
}

export async function GET(req: NextRequest) {
  if (isPrefetch(req)) {
    return new NextResponse(null, { status: 204 })
  }

  const mubeApiBaseUrl = process.env.MUBE_API_BASE_URL
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!mubeApiBaseUrl || !appBaseUrl) {
    console.error('[meta-connect] Missing envs', {
      mubeApiBaseUrl: !!mubeApiBaseUrl,
      appBaseUrl: !!appBaseUrl,
    })
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  // 1. Auth da sessão (cookie client)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // 2. Ler/atualizar meta_integration via admin (service_role)
  const admin = createCrmAdminClient()

  const { data: integration, error: intErr } = await admin
    .schema('meta')
    .from('meta_integration')
    .select('id, mube_tenant_id, status')
    .limit(1)
    .maybeSingle()

  if (intErr) {
    console.error('[meta-connect] Failed to read meta_integration', { intErr })
    return NextResponse.redirect(
      new URL('/dashboard/integracoes/meta?error=read_failed', req.url),
    )
  }

  if (!integration) {
    return NextResponse.redirect(
      new URL('/dashboard/integracoes/meta?error=no_integration', req.url),
    )
  }

  const { error: updateErr } = await admin
    .schema('meta')
    .from('meta_integration')
    .update({
      status: 'connecting',
      connected_by: user.id,
      last_error: null,
    })
    .eq('id', integration.id)

  if (updateErr) {
    console.error('[meta-connect] Failed to set connecting status', { updateErr })
    return NextResponse.redirect(
      new URL('/dashboard/integracoes/meta?error=update_failed', req.url),
    )
  }

  const redirectTo = `${appBaseUrl}/dashboard/integracoes/meta/callback`
  const params = new URLSearchParams({
    tenant_id: integration.mube_tenant_id,
    redirect_to: redirectTo,
  })

  const oauthUrl = `${mubeApiBaseUrl}/api/integrations/meta/connect?${params.toString()}`

  return NextResponse.redirect(oauthUrl)
}
