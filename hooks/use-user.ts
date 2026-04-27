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
//
// Additionally, we persist the resolved user to localStorage. On full page
// reloads (the only time the module-scope cache is lost) we hydrate from
// localStorage so the dashboard can decide its variant (consultor vs
// management) on the very first render — the dev_users round-trip becomes
// a background revalidation instead of a blocking fetch.
let inFlight: Promise<UserWithRole | null> | null = null
let cached: { user: UserWithRole | null; at: number } | null = null
const CACHE_TTL_MS = 30_000
const PERSIST_KEY = 'infinity-erp-user-cache-v1'
const PERSIST_TTL_MS = 30 * 60 * 1000 // 30 minutes — UI cap on staleness

function readPersistedCache(): { user: UserWithRole | null; at: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { user: UserWithRole | null; at: number }
    if (!parsed || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > PERSIST_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function persistCache(entry: { user: UserWithRole | null; at: number }) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(entry))
  } catch {
    // quota errors / private mode etc — silent
  }
}

function clearPersistedCache() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PERSIST_KEY)
  } catch {
    // silent
  }
}

// Hydrate the module-scope cache from localStorage at module load.
// Subsequent useUser() initial renders see `cached` populated and skip the
// loading state entirely — the in-flight revalidation runs in the background.
if (typeof window !== 'undefined' && !cached) {
  cached = readPersistedCache()
}

async function doFetchUser(): Promise<UserWithRole | null> {
  const supabase = createClient()

  // Use getSession() (sync read from cookies/storage) instead of getUser()
  // (network round-trip to /auth/v1/user). Middleware already validated the
  // JWT on this request, and the dev_users query below is protected by RLS
  // — a forged token would be rejected there. Saves ~200–500ms on every
  // dashboard load.
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession()

  if (authError) {
    if (authError.name === 'AuthSessionMissingError') return null
    throw authError
  }
  const authUser = session?.user
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
        const entry = { user, at: Date.now() }
        cached = entry
        persistCache(entry)
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
  clearPersistedCache()
}

export function useUser() {
  // Initial state must match between SSR (no `cached`, no `window`) and the
  // first client render (where `cached` may be hydrated from localStorage).
  // Seeding from cache here causes a hydration mismatch — instead, the cache
  // is consulted inside the effect below via fetchUserDeduped().
  const [user, setUser] = useState<UserWithRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadUser = useCallback(async (force: boolean) => {
    try {
      setError(null)
      const resolved = await fetchUserDeduped(force)
      setUser(resolved)
    } catch (err) {
      // Error objects serialize to `{}` in the Next.js dev overlay because
      // their `message`/`stack` are non-enumerable. Spread the relevant
      // fields explicitly so we actually see what failed.
      const detail =
        err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : err && typeof err === 'object'
          ? { ...(err as Record<string, unknown>) }
          : { value: String(err) }
      console.error('Erro ao carregar utilizador:', detail)
      setError(err instanceof Error ? err : new Error(JSON.stringify(detail)))
      // Keep whatever user was already in state — if we hydrated from
      // localStorage and the background revalidation fails (transient
      // network blip), don't blank out the dashboard. Genuine "no session"
      // is handled inside doFetchUser and resolves to null (not throw).
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
