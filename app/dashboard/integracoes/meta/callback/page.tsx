import { redirect } from 'next/navigation'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  status?: string
  connection_id?: string
  pages_count?: string
  error?: string
  error_reason?: string
}>

const ERROR_LABEL: Record<string, string> = {
  access_denied: 'Cancelaste a autorização no Facebook. Tenta novamente.',
  invalid_state:
    'O pedido de ligação expirou ou foi inválido. Volta a iniciar o processo.',
  state_already_consumed:
    'Este pedido já foi processado. Volta à página de integrações.',
  state_expired:
    'Demoraste mais de 15 minutos a autorizar. Volta a iniciar o processo.',
  missing_params: 'Faltaram parâmetros na resposta do Facebook.',
}

function errorMessageFor(error: string | undefined, reason?: string) {
  if (!error) return 'Não foi possível concluir a ligação.'
  return ERROR_LABEL[error] ?? `Erro na ligação: ${error}${reason ? ` (${reason})` : ''}`
}

export default async function MetaCallbackPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { status, connection_id, pages_count, error, error_reason } =
    await searchParams

  // 1. Auth via cookie client
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Mutações em meta.meta_integration via admin (service_role)
  const admin = createCrmAdminClient()
  const { data: integration } = await admin
    .schema('meta')
    .from('meta_integration')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (integration) {
    if (status === 'success') {
      await admin
        .schema('meta')
        .from('meta_integration')
        .update({
          status: 'connected',
          connected_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', integration.id)
    } else if (status === 'error') {
      await admin
        .schema('meta')
        .from('meta_integration')
        .update({
          status: 'error',
          last_error: errorMessageFor(error, error_reason),
        })
        .eq('id', integration.id)
    }
  }

  const isSuccess = status === 'success'
  const parsedPagesCount = pages_count
    ? Number.parseInt(pages_count, 10)
    : null
  const pagesCount =
    parsedPagesCount !== null && Number.isFinite(parsedPagesCount)
      ? parsedPagesCount
      : null

  return (
    <div className="mx-auto max-w-xl space-y-6 py-12">
      {/* Auto-redirect via meta refresh (sem JS) */}
      <meta httpEquiv="refresh" content="3; url=/dashboard/integracoes/meta" />

      <Card>
        <CardHeader>
          <CardTitle>
            {isSuccess
              ? 'Ligação concluída'
              : status === 'error'
                ? 'Erro ao ligar'
                : 'Estado desconhecido'}
          </CardTitle>
          <CardDescription>
            {isSuccess
              ? 'A conta Meta foi ligada com sucesso. A redirigir para a página de integrações…'
              : 'A redirigir para a página de integrações…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuccess && (
            <Alert>
              <AlertTitle>Resumo</AlertTitle>
              <AlertDescription>
                {pagesCount !== null
                  ? `${pagesCount} Page${pagesCount === 1 ? '' : 's'} configurada${pagesCount === 1 ? '' : 's'}. `
                  : ''}
                Os leads dos últimos 7 dias estão a ser importados em segundo
                plano.
                {connection_id ? (
                  <span className="text-muted-foreground mt-2 block font-mono text-xs">
                    connection_id: {connection_id}
                  </span>
                ) : null}
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <Alert variant="destructive">
              <AlertTitle>Detalhe</AlertTitle>
              <AlertDescription>
                {errorMessageFor(error, error_reason)}
              </AlertDescription>
            </Alert>
          )}

          <a
            href="/dashboard/integracoes/meta"
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
            Voltar agora
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
