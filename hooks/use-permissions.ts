'use client'

import { useUser } from './use-user'

type PermissionModule =
  | 'dashboard'
  | 'properties'
  | 'leads'
  | 'processes'
  | 'documents'
  | 'consultants'
  | 'owners'
  | 'teams'
  | 'commissions'
  | 'marketing'
  | 'templates'
  | 'settings'
  | 'goals'
  | 'store'
  | 'users'
  | 'buyers'
  | 'credit'
  | 'calendar'
  | 'pipeline'
  | 'financial'
  | 'integration'
  | 'recruitment'

interface Permissions {
  [key: string]: boolean
}

export function usePermissions() {
  const { user, loading } = useUser()

  const hasPermission = (module: PermissionModule): boolean => {
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
    return user?.role?.name?.toLowerCase() === 'broker/ceo'
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
