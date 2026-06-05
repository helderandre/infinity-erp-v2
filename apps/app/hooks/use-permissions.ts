'use client'

import { useUser } from './use-user'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import type { ALL_PERMISSION_MODULES } from '@/lib/auth/roles'

type PermissionModule = (typeof ALL_PERMISSION_MODULES)[number]

interface Permissions {
  [key: string]: boolean
}

export function usePermissions() {
  const { user, loading } = useUser()

  const hasPermission = (module: PermissionModule): boolean => {
    // While the user is still loading, return true optimistically so
    // permission-gated UI (sidebar items, menus) renders the structure
    // immediately instead of collapsing to an empty shell. Middleware
    // already verified the user is authenticated; we just don't yet know
    // which modules they can access — and authorization is enforced
    // server-side anyway, so the optimistic UI cannot grant real access.
    if (loading) return true

    if (!user?.role?.permissions) return false

    const permissions = user.role.permissions as Permissions
    return permissions[module] === true
  }

  const hasAnyPermission = (modules: PermissionModule[]): boolean => {
    return modules.some((module) => hasPermission(module))
  }

  const hasAllPermissions = (modules: PermissionModule[]): boolean => {
    return modules.every((module) => hasPermission(module))
  }

  const isBroker = (): boolean => {
    return ADMIN_ROLES.some((r) => r.toLowerCase() === user?.role?.name?.toLowerCase())
  }

  const isTeamLeader = (): boolean => {
    return user?.role?.name?.toLowerCase() === 'team_leader'
  }

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isBroker,
    isTeamLeader,
    loading,
    permissions: (user?.role?.permissions as Permissions) || {},
  }
}
