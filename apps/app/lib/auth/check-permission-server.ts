import { ADMIN_ROLES } from '@/lib/auth/roles'
import type { SupabaseClient } from '@supabase/supabase-js'

type PermissionKey =
  | 'dashboard' | 'properties' | 'leads' | 'processes' | 'documents'
  | 'consultants' | 'owners' | 'teams' | 'commissions' | 'marketing'
  | 'templates' | 'settings' | 'goals' | 'store' | 'users' | 'buyers'
  | 'credit' | 'calendar' | 'pipeline' | 'financial' | 'integration'
  | 'recruitment' | 'training'

/**
 * Server-side check for whether the given auth user has a given permission
 * module set to true on any of their roles. Admin roles (Broker/CEO, admin)
 * implicitly have every permission.
 */
export async function hasPermissionServer(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  permission: PermissionKey
): Promise<boolean> {
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('roles:roles(name, permissions)')
    .eq('user_id', userId)

  if (!userRoles || userRoles.length === 0) return false

  for (const ur of userRoles as any[]) {
    const role = ur.roles
    if (!role) continue
    if (ADMIN_ROLES.some((ar) => ar.toLowerCase() === role.name?.toLowerCase())) {
      return true
    }
    const perms = role.permissions as Record<string, boolean> | null
    if (perms && perms[permission] === true) return true
  }
  return false
}
