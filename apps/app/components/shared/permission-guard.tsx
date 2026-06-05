'use client'

import { usePermissions } from '@/hooks/use-permissions'
import { useUser } from '@/hooks/use-user'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { ALL_PERMISSION_MODULES } from '@/lib/auth/roles'

type PermissionModule = (typeof ALL_PERMISSION_MODULES)[number]

export function PermissionGuard({
  module,
  children,
}: {
  module: PermissionModule | PermissionModule[]
  children: React.ReactNode
}) {
  const { hasPermission, hasAnyPermission, loading: permsLoading } = usePermissions()
  const { user } = useUser()
  const router = useRouter()

  const allowed = Array.isArray(module)
    ? hasAnyPermission(module as any)
    : hasPermission(module as any)

  // Only redirect when we're confident the permission is genuinely denied:
  // perms finished loading AND the user object exists AND the role carries
  // a permissions payload but that module is false. Skipping the user-null
  // case prevents a transient race (e.g. auth SIGNED_IN re-fetch where
  // `loading` can momentarily be false while `user` is still the previous
  // stale value) from bouncing the user out of a guarded route.
  useEffect(() => {
    if (permsLoading) return
    if (!user) return
    if (!user.role?.permissions) return
    if (!allowed) {
      router.replace('/dashboard')
    }
  }, [permsLoading, user, allowed, router])

  if (permsLoading || !user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!allowed) return null

  return <>{children}</>
}
