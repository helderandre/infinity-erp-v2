import { redirect } from 'next/navigation'
import { createClient } from '@infinity/lib/supabase/server'
import { canAccessSurface } from '@infinity/lib/auth/roles'
import { Card, CardContent, CardHeader, CardTitle } from '@infinity/ui/card'
import { PortalShell } from '@portal/components/portal/portal-shell'

export const dynamic = 'force-dynamic'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id)

  const roles = (roleRows ?? []).flatMap((r: { roles: unknown }) => {
    const rel = r?.roles as { name?: string | null } | { name?: string | null }[] | null
    if (Array.isArray(rel)) return rel.map((x) => x?.name ?? null)
    return [rel?.name ?? null]
  })

  if (!canAccessSurface('parceiros', roles)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader><CardTitle>Sem acesso</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              A sua conta não tem permissões de parceiro. Contacte a Infinity Group.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  const { data: profile } = await supabase
    .from('dev_users')
    .select('commercial_name, dev_consultant_profiles(profile_photo_url)')
    .eq('id', user.id)
    .maybeSingle()

  const prof = profile as { commercial_name?: string | null; dev_consultant_profiles?: { profile_photo_url?: string | null } | { profile_photo_url?: string | null }[] | null } | null
  const photoRel = prof?.dev_consultant_profiles
  const avatarUrl = Array.isArray(photoRel) ? photoRel[0]?.profile_photo_url ?? null : photoRel?.profile_photo_url ?? null

  return (
    <PortalShell
      user={{ email: user.email ?? null, name: prof?.commercial_name ?? null, avatarUrl }}
    >
      {children}
    </PortalShell>
  )
}
