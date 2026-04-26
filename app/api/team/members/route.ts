import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { classifyUserMembership } from '@/lib/auth/roles'

/**
 * Lightweight team-members endpoint used by the dashboard Profile sheet
 * "Equipa" tab. Auth-only (no special permission required) — returns the
 * basic public-facing info every colleague needs to know about every other
 * colleague: name, role, photo, professional email, commercial phone.
 *
 * Each member is classified into a single bucket — 'consultor' or 'staff' —
 * via classifyUserMembership (staff > consultor priority). Members that
 * resolve to 'other' (e.g. external clients, unknown roles) are dropped
 * from the response — the team list only shows internal colleagues.
 *
 * Excludes the calling user from the results (you don't need to see
 * yourself in the team list).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('dev_users')
      .select(`
        id,
        commercial_name,
        professional_email,
        dev_consultant_profiles ( profile_photo_url, phone_commercial ),
        user_roles!user_roles_user_id_fkey ( roles ( id, name ) )
      `)
      .eq('is_active', true)
      .neq('id', user.id)
      .order('commercial_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const members = (data ?? [])
      .map((u: any) => {
        const profile = Array.isArray(u.dev_consultant_profiles)
          ? u.dev_consultant_profiles[0]
          : u.dev_consultant_profiles

        const roleRows: any[] = Array.isArray(u.user_roles) ? u.user_roles : []
        const roleNames = roleRows.map((r) => {
          const role = Array.isArray(r.roles) ? r.roles[0] : r.roles
          return role?.name ?? null
        }).filter(Boolean) as string[]

        const classification = classifyUserMembership(roleNames)

        return {
          id: u.id,
          commercial_name: u.commercial_name,
          professional_email: u.professional_email,
          profile_photo_url: profile?.profile_photo_url ?? null,
          phone_commercial: profile?.phone_commercial ?? null,
          // Display the most representative role name (first one).
          role_name: roleNames[0] ?? null,
          classification,
        }
      })
      .filter((m: any) => m.classification !== 'other')

    return NextResponse.json({ members })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
