import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Facebook, Link2, AlertCircle, CheckCircle2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

import { DisconnectMetaButton } from './disconnect-button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Integração Meta — ERP Infinity' }

type SearchParams = Promise<{ error?: string }>

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  disconnected: { label: 'Desligado', variant: 'outline' },
  connecting: { label: 'A ligar…', variant: 'secondary' },
  connected: { label: 'Ligado', variant: 'default' },
  error: { label: 'Erro', variant: 'destructive' },
}

const ERROR_MESSAGE: Record<string, string> = {
  no_integration:
    'O tenant ainda não foi cadastrado no meta-api. Contacta a Mube Systems para concluir o setup.',
  read_failed:
    'Não foi possível ler o estado da integração. Tenta recarregar a página.',
  update_failed: 'Não foi possível iniciar o pedido de ligação. Tenta novamente.',
}

function formatPt(iso: string | null): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default async function MetaIntegrationPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { error: errorParam } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createCrmAdminClient()
  const { data: integration } = await admin
    .schema('meta')
    .from('meta_integration')
    .select('id, status, connected_at, last_error, mube_tenant_id')
    .limit(1)
    .maybeSingle()

  const status = integration?.status ?? 'disconnected'
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.disconnected
  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Integração Meta Ads</h1>
          <p className="text-muted-foreground text-sm">
            Recebe leads do Facebook e Instagram diretamente no ERP via Mube
            Systems.
          </p>
        </div>
        <Badge variant={badge.variant} className="text-xs">
          {badge.label}
        </Badge>
      </header>

      {errorParam && ERROR_MESSAGE[errorParam] && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{ERROR_MESSAGE[errorParam]}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-[#1877F2]" />
            Conta Facebook / Instagram
          </CardTitle>
          <CardDescription>
            A Mube Systems gere o acesso ao Facebook. Os tokens nunca ficam
            guardados neste ERP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!integration && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Integração não inicializada</AlertTitle>
              <AlertDescription>
                A row em <code className="text-xs">meta.meta_integration</code> ainda
                não existe. Avisa o admin da Mube Systems para criar o tenant.
              </AlertDescription>
            </Alert>
          )}

          {integration && (
            <>
              {isConnected && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertTitle>Ligada</AlertTitle>
                  <AlertDescription>
                    Ligado desde {formatPt(integration.connected_at) ?? '—'}.
                    Os leads vão chegar automaticamente ao webhook do ERP.
                  </AlertDescription>
                </Alert>
              )}

              {status === 'error' && integration.last_error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro reportado</AlertTitle>
                  <AlertDescription>{integration.last_error}</AlertDescription>
                </Alert>
              )}

              <dl className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs uppercase">
                    Tenant ID
                  </dt>
                  <dd className="font-mono text-xs">
                    {integration.mube_tenant_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs uppercase">
                    Estado
                  </dt>
                  <dd>
                    <Badge variant={badge.variant} className="text-[10px]">
                      {badge.label}
                    </Badge>
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {!isConnected && (
                  <Button asChild>
                    <Link href="/api/integrations/meta/connect">
                      <Facebook className="mr-2 h-4 w-4" />
                      {isConnecting ? 'Continuar ligação…' : 'Ligar à conta Facebook'}
                    </Link>
                  </Button>
                )}
                {isConnected && (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/api/integrations/meta/connect">Reconectar</Link>
                    </Button>
                    <DisconnectMetaButton />
                  </>
                )}
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/analise-meta">
                    <Link2 className="mr-2 h-4 w-4" />
                    Ver dados sincronizados
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            1. Clicas em <strong>Ligar à conta Facebook</strong>. És redirecionado
            para o meta-api e depois para o consent screen do Facebook.
          </p>
          <p>
            2. Autorizas as Pages que tens permissão para gerir. O meta-api
            grava tokens criptografados na Mube Vault.
          </p>
          <p>
            3. O meta-api inscreve cada Page no evento <code className="text-xs">leadgen</code> e
            começa a enviar webhooks assinados (X-Mube-Signature-256) para este
            ERP em <code className="text-xs">/api/webhooks/mube/events</code>.
          </p>
          <p>
            4. Os 4 tipos de eventos (lead.created, form.synced, campaign.synced,
            ad.synced) são persistidos em <code className="text-xs">meta.meta_*_raw</code> e
            ficam disponíveis em <em>Análise Meta</em>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
