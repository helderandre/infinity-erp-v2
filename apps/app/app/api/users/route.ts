import { NextResponse } from 'next/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireRoles } from '@/lib/auth/permissions'

const ALLOWED_ROLES = ['admin', 'Broker/CEO', 'Office Manager'] as const

export const dynamic = 'force-dynamic'

/**
 * Lista de utilizadores com roles e contagem de overrides — para a página de
 * gestão de utilizadores em /dashboard/definicoes/utilizadores.
 */
export async function GET() {
  const auth = await requireRoles(ALLOWED_ROLES)
  if (!auth.authorized) return auth.response

  const db = createCrmAdminClient() as any

  const { data: users, error } = await db
    .from('dev_users')
    .select(`
      id,
      commercial_name,
      professional_email,
      is_active,
      created_at,
      user_roles!user_roles_user_id_fkey(
        role:roles(id, name)
      )
    `)
    .order('commercial_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = (users || []).map((u: { id: string }) => u.id)
  const overrideCounts = new Map<string, number>()
  if (userIds.length > 0) {
    const { data: overrides } = await db
      .from('user_permission_overrides')
      .select('user_id')
      .in('user_id', userIds)
    for (const o of (overrides || []) as Array<{ user_id: string }>) {
      overrideCounts.set(o.user_id, (overrideCounts.get(o.user_id) ?? 0) + 1)
    }
  }

  const data = (users || []).map((u: any) => ({
    id: u.id,
    commercial_name: u.commercial_name,
    professional_email: u.professional_email,
    is_active: u.is_active,
    created_at: u.created_at,
    roles: (u.user_roles ?? [])
      .map((ur: any) => ur.role)
      .filter(Boolean)
      .map((r: any) => ({ id: r.id, name: r.name })),
    override_count: overrideCounts.get(u.id) ?? 0,
  }))

  return NextResponse.json({ data })
}
