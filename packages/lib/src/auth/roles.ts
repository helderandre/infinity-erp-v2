/**
 * Shared role definitions across all Infinity apps (app / parceiros / clientes).
 * These three surfaces hit the SAME Supabase backend, so access to each app is
 * gated by role here rather than by a separate auth system.
 */

/** Full-access internal roles (superadmin). */
export const ADMIN_ROLES = ['admin', 'Broker/CEO', 'Office Manager'] as const

/** Internal staff roles allowed on the main ERP (app.infinitygroup.pt). */
export const INTERNAL_ROLES = [
  'admin',
  'Broker/CEO',
  'Office Manager',
  'Gestor Processual',
  'Gestora Processual',
  'Team Leader',
  'Consultor',
  'Consultora Executiva',
  'Marketing',
  'Recrutador',
  'Intermediário de Crédito',
  'Gestora de Leads',
  'Staff',
] as const

/** Roles allowed on the partners app (parceiros.infinitygroup.pt). */
export const PARTNER_ROLES = ['parceiro', 'Parceiro'] as const

/** Roles allowed on the clients app (clientes.infinitygroup.pt). */
export const CLIENT_ROLES = ['cliente', 'Cliente'] as const

export type AppSurface = 'app' | 'parceiros' | 'clientes'

const SURFACE_ROLES: Record<AppSurface, ReadonlyArray<string>> = {
  app: INTERNAL_ROLES,
  parceiros: PARTNER_ROLES,
  clientes: CLIENT_ROLES,
}

function lc(roles: ReadonlyArray<string | null | undefined>): string[] {
  return roles.filter((r): r is string => !!r).map((r) => r.toLowerCase())
}

/** True if any of the user's roles grants access to the given app surface. */
export function canAccessSurface(
  surface: AppSurface,
  roles: ReadonlyArray<string | null | undefined>,
): boolean {
  const have = lc(roles)
  // Admins can access every surface.
  if (ADMIN_ROLES.some((r) => have.includes(r.toLowerCase()))) return true
  return SURFACE_ROLES[surface].some((r) => have.includes(r.toLowerCase()))
}

export function isAdmin(roles: ReadonlyArray<string | null | undefined>): boolean {
  const have = lc(roles)
  return ADMIN_ROLES.some((r) => have.includes(r.toLowerCase()))
}

export function isPartner(roles: ReadonlyArray<string | null | undefined>): boolean {
  const have = lc(roles)
  return PARTNER_ROLES.some((r) => have.includes(r.toLowerCase()))
}

export function isClient(roles: ReadonlyArray<string | null | undefined>): boolean {
  const have = lc(roles)
  return CLIENT_ROLES.some((r) => have.includes(r.toLowerCase()))
}
