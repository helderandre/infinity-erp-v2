import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { createClient } from '@/lib/supabase/server'

import { MetaRefreshButtons } from './meta-refresh-buttons'

/**
 * Wrapper server-side que só mostra os botões "Atualizar agora" a quem tem
 * permissão `settings` (as server actions enforçam o mesmo — isto é só UX para
 * não mostrar botões que iriam falhar a consultores).
 */
export async function MetaRefreshControls({
  show = 'both',
}: {
  show?: 'both' | 'campaigns' | 'performance'
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const canManage = await hasPermissionServer(supabase, user.id, 'settings')
  if (!canManage) return null

  return <MetaRefreshButtons show={show} />
}
