import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { createClient } from '@/lib/supabase/server'
import type { SyncResource } from '@/hooks/use-meta-sync-job'

import { MetaRefreshDialog } from './meta-refresh-dialog'

/**
 * Wrapper server-side que só mostra o diálogo "Atualizar dados Meta" a quem tem
 * permissão `settings` (a route action enforça o mesmo — isto é só UX para não
 * mostrar o botão a consultores).
 *
 * `defaultResources` pré-selecciona os recursos no diálogo (ex.: nas páginas de
 * detalhe de campanha/anúncio o foco é o desempenho).
 */
export async function MetaRefreshControls({
  defaultResources,
}: {
  defaultResources?: SyncResource[]
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const canManage = await hasPermissionServer(supabase, user.id, 'settings')
  if (!canManage) return null

  return <MetaRefreshDialog defaultResources={defaultResources} />
}
