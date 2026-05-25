import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, Facebook } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { createClient } from '@/lib/supabase/server'

import { fetchScopePreview } from './actions'
import { ScopeForm } from './scope-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Configurar scope — Integração Meta' }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SearchParams = Promise<{
  connection_id?: string
  from?: string
}>

export default async function MetaScopePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const connectionId = sp.connection_id
  const fromOauth = sp.from === 'oauth'

  // Auth + permission (middleware já garante login; double-check + gate de permissão)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasSettings = await hasPermissionServer(supabase, user.id, 'settings')
  if (!hasSettings) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Sem permissão</AlertTitle>
          <AlertDescription>
            Esta página requer a permissão <code>settings</code>. Contacta um
            administrador.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Validate connection_id
  if (!connectionId || !UUID_RE.test(connectionId)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection ID em falta</AlertTitle>
          <AlertDescription>
            Esta página espera um <code>?connection_id=&lt;uuid&gt;</code>{' '}
            válido. Volta à página de integração e clica em
            &ldquo;Configurar dados sincronizados&rdquo; ou refaz o OAuth.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/dashboard/integracoes/meta">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar à integração
          </Link>
        </Button>
      </div>
    )
  }

  // Fetch initial preview (include_client=false). Pode demorar até ~10s.
  const result = await fetchScopePreview(connectionId, false)

  if (!result.ok) {
    const isAuthErr = result.status === 401 || result.status === 403
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro a carregar preview</AlertTitle>
          <AlertDescription>
            <code>{result.error}</code>
            {result.status ? ` (HTTP ${result.status})` : ''}
            {isAuthErr && (
              <span className="mt-2 block">
                Verifica <code>MUBE_ADMIN_SECRET</code> e{' '}
                <code>MUBE_API_BASE_URL</code> no <code>.env.local</code>.
              </span>
            )}
            {result.error === 'connection_missing_token' && (
              <span className="mt-2 block">
                A conexão perdeu o token Meta (expirou ou foi revogado). Refaz
                o OAuth.
              </span>
            )}
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/integracoes/meta">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
          {result.error === 'connection_missing_token' && (
            <Button asChild>
              <Link
                href="/api/integrations/meta/connect"
                prefetch={false}
              >
                <Facebook className="mr-2 h-4 w-4" />
                Refazer OAuth
              </Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  const preview = result.data

  // Empty state: connection sem Pages (provável erro de OAuth)
  if (preview.pages.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <header className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Link
              href="/dashboard/integracoes/meta"
              className="hover:underline"
            >
              Integração Meta
            </Link>
            <span>/</span>
            <span>Scope</span>
          </div>
          <h1 className="text-2xl font-semibold">
            Confirmar scope da conexão Meta
          </h1>
        </header>

        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="h-10 w-10 text-amber-500" />
            <div>
              <p className="font-medium">Sem Pages activas nesta conexão</p>
              <p className="text-muted-foreground mt-1 text-sm">
                A conexão não tem Pages associadas — geralmente significa que o
                consent OAuth foi feito sem seleccionar nenhuma Page. Refaz o
                OAuth e escolhe as Pages que queres sincronizar.
              </p>
            </div>
            <Button asChild>
              <Link href="/api/integrations/meta/connect" prefetch={false}>
                <Facebook className="mr-2 h-4 w-4" />
                Refazer OAuth
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-1">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Link href="/dashboard/integracoes/meta" className="hover:underline">
            Integração Meta
          </Link>
          <span>/</span>
          <span>Scope</span>
        </div>
        <h1 className="text-2xl font-semibold">
          Confirmar scope da conexão Meta
        </h1>
        <p className="text-muted-foreground font-mono text-xs">
          tenant {preview.tenant_id} · connection {preview.connection_id}
        </p>
      </header>

      <ScopeForm initial={preview} fromOauth={fromOauth} />
    </div>
  )
}
