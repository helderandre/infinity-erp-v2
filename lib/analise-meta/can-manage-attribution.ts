import { ADMIN_ROLES, MANAGEMENT_ROLES } from '@/lib/auth/roles'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>

/**
 * Quem pode gerir a atribuição de campanhas/anúncios Meta a consultores:
 * gestão (MANAGEMENT_ROLES / admin) OU quem tem a permissão `marketing`/`users`.
 * Decisão do stakeholder: "Managers/Marketing only".
 */
export async function canManageAttribution(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('roles:roles(name, permissions)')
    .eq('user_id', userId)

  if (!data) return false

  const norm = (s: string | null | undefined) => (s ?? '').toLowerCase()
  const allowedRoles = new Set([...ADMIN_ROLES, ...MANAGEMENT_ROLES].map(norm))

  for (const ur of data as Array<{ roles?: { name?: string; permissions?: Record<string, boolean> | null } | null }>) {
    const role = ur.roles
    if (!role) continue
    if (allowedRoles.has(norm(role.name))) return true
    const perms = role.permissions
    if (perms && (perms.marketing === true || perms.users === true)) return true
  }
  return false
}
