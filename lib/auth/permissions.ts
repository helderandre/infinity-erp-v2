import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { ALL_PERMISSION_MODULES } from '@/lib/auth/roles'

// ─── Tipos ────────────────────────────────────────────────

export type PermissionModule = (typeof ALL_PERMISSION_MODULES)[number]

export interface AuthResult {
  authorized: true
  user: { id: string; email?: string }
  roles: string[]
  permissions: Record<string, boolean>
}

export interface AuthError {
  authorized: false
  response: NextResponse
}

// ─── Funções Principais ───────────────────────────────────

/**
 * Verificar apenas autenticação (sem permissão granular).
 * Substitui o bloco repetido: supabase.auth.getUser() + if (!user) return 401
 */
export async function requireAuth(): Promise<AuthResult | AuthError> {
  // ── Worker bypass ────────────────────────────────────────────────────
  // The bulk-send queue worker (/api/scheduler/run-bulk-sends) needs to
  // call the same single-target endpoints the UI uses, but without a
  // browser cookie. When it presents the service-role bearer + a
  // X-Worker-User-Id header, we trust it and impersonate that user for
  // the rest of the request. Used ONLY by code paths inside our own
  // backend — never exposed to the public — so the trust boundary
  // matches anyone who already has SUPABASE_SERVICE_ROLE_KEY.
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (SERVICE_KEY) {
    const hdr = await headers()
    const auth = hdr.get('authorization')
    const workerUserId = hdr.get('x-worker-user-id')
    if (
      auth === `Bearer ${SERVICE_KEY}` &&
      workerUserId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workerUserId)
    ) {
      const result = await loadDevUserAuth(workerUserId)
      if (result) return result
    }
  }

  // ── Normal cookie-based path ─────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }),
    }
  }

  // Carregar roles + permissões numa única query
  const { data: devUser } = await supabase
    .from('dev_users')
    .select(`
      id,
      user_roles!user_roles_user_id_fkey!inner(
        role:roles(name, permissions)
      )
    `)
    .eq('id', user.id)
    .single()

  const userRoles = ((devUser as any)?.user_roles || [])
    .map((ur: any) => ur.role?.name)
    .filter(Boolean) as string[]

  // Merge de permissões (OR lógico)
  const isAdmin = userRoles.some((r) =>
    ['admin', 'Broker/CEO'].includes(r)
  )

  const mergedPermissions: Record<string, boolean> = {}
  if (isAdmin) {
    ALL_PERMISSION_MODULES.forEach((m) => { mergedPermissions[m] = true })
  } else {
    ;((devUser as any)?.user_roles || []).forEach((ur: any) => {
      const perms = ur.role?.permissions as Record<string, boolean> | undefined
      if (perms) {
        Object.entries(perms).forEach(([k, v]) => {
          if (v === true) mergedPermissions[k] = true
        })
      }
    })
  }

  return {
    authorized: true,
    user: { id: user.id, email: user.email },
    roles: userRoles,
    permissions: mergedPermissions,
  }
}

/**
 * Build an AuthResult for a given user id using the admin client. Used
 * only by the worker-bypass path of `requireAuth` — it skips the cookie
 * check but rebuilds roles + permissions exactly the same way as the
 * normal path so downstream permission checks behave identically.
 */
async function loadDevUserAuth(userId: string): Promise<AuthResult | null> {
  try {
    const admin = createAdminClient() as any
    const { data: devUser, error } = await admin
      .from('dev_users')
      .select(`
        id,
        professional_email,
        user_roles!user_roles_user_id_fkey!inner(
          role:roles(name, permissions)
        )
      `)
      .eq('id', userId)
      .single()
    if (error || !devUser) return null

    const userRoles = ((devUser as any)?.user_roles || [])
      .map((ur: any) => ur.role?.name)
      .filter(Boolean) as string[]

    const isAdmin = userRoles.some((r) =>
      ['admin', 'Broker/CEO'].includes(r),
    )

    const mergedPermissions: Record<string, boolean> = {}
    if (isAdmin) {
      ALL_PERMISSION_MODULES.forEach((m) => { mergedPermissions[m] = true })
    } else {
      ;((devUser as any)?.user_roles || []).forEach((ur: any) => {
        const perms = ur.role?.permissions as Record<string, boolean> | undefined
        if (perms) {
          Object.entries(perms).forEach(([k, v]) => {
            if (v === true) mergedPermissions[k] = true
          })
        }
      })
    }

    return {
      authorized: true,
      user: { id: userId, email: (devUser as any)?.professional_email ?? undefined },
      roles: userRoles,
      permissions: mergedPermissions,
    }
  } catch {
    return null
  }
}

/**
 * Verificar autenticação + permissão por módulo.
 * Retorna 401 se não autenticado, 403 se sem permissão.
 */
export async function requirePermission(
  module: PermissionModule
): Promise<AuthResult | AuthError> {
  const auth = await requireAuth()
  if (!auth.authorized) return auth

  if (!auth.permissions[module]) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: `Sem permissão para o módulo: ${module}` },
        { status: 403 }
      ),
    }
  }

  return auth
}

/**
 * Verificar autenticação + se o utilizador tem uma das roles indicadas.
 * Para acções específicas que dependem de role (approve, reject, adhoc tasks, etc.).
 */
export async function requireRoles(
  allowedRoles: readonly string[]
): Promise<AuthResult | AuthError> {
  const auth = await requireAuth()
  if (!auth.authorized) return auth

  // Admin/Broker tem sempre acesso
  const isAdmin = auth.roles.some((r) =>
    ['admin', 'Broker/CEO'].includes(r)
  )

  if (!isAdmin && !auth.roles.some((r) => allowedRoles.includes(r))) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Sem permissão para esta acção' },
        { status: 403 }
      ),
    }
  }

  return auth
}
