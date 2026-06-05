'use server'

import { redirect } from 'next/navigation'

import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { signMubeRequest } from '@/lib/mube/signature'
import { createClient } from '@/lib/supabase/server'

/**
 * Action invocada por <form action={goToScopePicker}> no botão
 * "Configurar dados sincronizados". Descobre o connection_id activo via
 * GET /api/integrations/meta/connection (HMAC tenant-signed) e redireciona
 * para o scope picker já com o param preenchido.
 *
 * Sem isto, o utilizador chegaria a /scope sem connection_id e veria o estado
 * de erro. Usamos HMAC (não X-Admin-Secret) porque o endpoint /connection é
 * tenant-facing — temos o secret do destination.
 */
export async function goToScopePicker(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasSettings = await hasPermissionServer(
    supabase,
    user.id,
    'settings',
  )
  if (!hasSettings) {
    redirect('/dashboard/integracoes/meta?error=forbidden')
  }

  const mubeApiBaseUrl = process.env.MUBE_API_BASE_URL
  const tenantId = process.env.MUBE_TENANT_ID
  const signingSecret = process.env.MUBE_SIGNING_SECRET
  if (!mubeApiBaseUrl || !tenantId || !signingSecret) {
    console.error('[scope-entry] missing envs')
    redirect('/dashboard/integracoes/meta?error=server_misconfigured')
  }

  const pathWithQuery = `/api/integrations/meta/connection?tenant_id=${tenantId}`
  const { timestamp, signature } = signMubeRequest({
    method: 'GET',
    pathWithQuery,
    body: '',
    secret: signingSecret,
  })

  // Pattern: NÃO chamar redirect() dentro de try/catch — o redirect() do Next.js
  // lança internamente um NEXT_REDIRECT que o catch engoliria. Capturamos o
  // estado e despachamos depois.
  let connectionId: string | null = null
  let fetchFailed = false
  try {
    const res = await fetch(`${mubeApiBaseUrl}${pathWithQuery}`, {
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
      console.warn('[scope-entry] /connection non-2xx', {
        status: res.status,
      })
      fetchFailed = true
    } else {
      const body = (await res.json()) as {
        connected: boolean
        connection: { id?: string } | null
      }
      connectionId = body?.connection?.id ?? null
    }
  } catch (err) {
    console.error('[scope-entry] /connection fetch threw', { err })
    fetchFailed = true
  }

  if (fetchFailed) {
    redirect('/dashboard/integracoes/meta?error=connection_fetch_failed')
  }
  if (!connectionId) {
    redirect('/dashboard/integracoes/meta?error=no_active_connection')
  }
  redirect(
    `/dashboard/integracoes/meta/scope?connection_id=${connectionId}`,
  )
}
