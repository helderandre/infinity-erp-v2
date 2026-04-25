'use client'

import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import type { Database } from '@/types/database'
import { ADMIN_ROLES, ALL_PERMISSION_MODULES } from '@/lib/auth/roles'

type DevUser = Database['public']['Tables']['dev_users']['Row']
type Role = Database['public']['Tables']['roles']['Row']

// Tipo para o retorno da query com user_roles nested
type DevUserWithRoles = DevUser & {
  user_roles: Array<{
    role: Role
  }>
  dev_consultant_profiles: { profile_photo_url: string | null } | null
}

export interface UserWithRole extends DevUser {
  role: Role | null
  auth_user: User | null
  profile_photo_url: string | null
}

// ── Module-level fetch dedupe + short cache ─────────────────────────────────
// When multiple components mount useUser() in the same tick (opening a sheet
// with several sub-components all calling useUser), we previously fired N
// concurrent supabase.auth.getUser() calls. Each acquires the
// `lock:sb-<project>-auth-token` Navigator lock; if any hangs (stuck token
// refresh, slow network, another tab holding the lock), the rest time out
// after 10s.
//
// This cache returns the same in-flight Promise to all callers and keeps the
// resolved user warm for 30s so fast remounts don't refetch unnecessarily.
let inFlight: Promise<UserWithRole | null> | null = null
let cached: { user: UserWithRole | null; at: number } | null = null
const CACHE_TTL_MS = 30_000

async function doFetchUser(): Promise<UserWithRole | null> {
  const supabase = createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) throw authError
  if (!authUser) return null

  const { data: devUser, error: devUserError } = await supabase
    .from('dev_users')
    .select(
      `
      *,
      user_roles!user_roles_user_id_fkey!inner(
        role:roles(*)
      ),
      dev_consultant_profiles(profile_photo_url)
    `
    )
    .eq('id', authUser.id)
    .single()

  if (devUserError) throw devUserError
  if (!devUser) throw new Error('Utilizador não encontrado')

  const userData = devUser as unknown as DevUserWithRoles

  const hasAdminRole = userData.user_roles?.some((ur) =>
    ADMIN_ROLES.some((ar) => ar.toLowerCase() === ur.role.name?.toLowerCase())
  )

  const mergedPermissions: Record<string, boolean> = {}
  if (hasAdminRole) {
    ALL_PERMISSION_MODULES.forEach((module) => {
      mergedPermissions[module] = true
    })
  } else {
    userData.user_roles?.forEach((userRole) => {
      const permissions = userRole.role.permissions as Record<string, boolean>
      if (permissions) {
        Object.keys(permissions).forEach((key) => {
          if (permissions[key] === true) mergedPermissions[key] = true
        })
      }
    })
  }

  const baseRole = userData.user_roles?.[0]?.role || null
  const combinedRole = baseRole
    ? { ...baseRole, permissions: mergedPermissions }
    : null

  const { user_roles: _ur, dev_consultant_profiles, ...userDataWithoutRoles } = userData

  return {
    ...userDataWithoutRoles,
    role: combinedRole as Role | null,
    auth_user: authUser,
    profile_photo_url: dev_consultant_profiles?.profile_photo_url || null,
  }
}

function fetchUserDeduped(force = false): Promise<UserWithRole | null> {
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return Promise.resolve(cached.user)
  }
  if (!inFlight) {
    inFlight = doFetchUser()
      .then((user) => {
        cached = { user, at: Date.now() }
        return user
      })
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

function invalidateUserCache() {
  cached = null
  inFlight = null
}

export function useUser() {
  const [user, setUser] = useState<UserWithRole | null>(() => cached?.user ?? null)
  const [loading, setLoading] = useState(() => !cached)
  const [error, setError] = useState<Error | null>(null)

  const loadUser = useCallback(async (force: boolean) => {
    try {
      setError(null)
      const resolved = await fetchUserDeduped(force)
      setUser(resolved)
    } catch (err) {
      console.error('Erro ao carregar utilizador:', err)
      setError(err instanceof Error ? err : new Error('Erro desconhecido'))
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()

    loadUser(false)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return

      if (event === 'SIGNED_OUT') {
        invalidateUserCache()
        setUser(null)
        setLoading(false)
        return
      }

      if (session?.user) {
        invalidateUserCache()
        loadUser(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [loadUser])

  return { user, loading, error, isAuthenticated: !!user }
}
