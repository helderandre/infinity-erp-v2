'use client'

import { usePermissions } from '@/hooks/use-permissions'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { ALL_PERMISSION_MODULES } from '@/lib/auth/roles'

type PermissionModule = (typeof ALL_PERMISSION_MODULES)[number]

export function PermissionGuard({
  module,
  children,
}: {
  module: PermissionModule
  children: React.ReactNode
}) {
  const { hasPermission, loading } = usePermissions()
  const router = useRouter()

  const allowed = hasPermission(module as any)

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace('/dashboard')
    }
  }, [loading, allowed, router])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!allowed) return null

  return <>{children}</>
}
