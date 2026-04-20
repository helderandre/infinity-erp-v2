import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/permissions'
import { ADMIN_ROLES } from '@/lib/auth/roles'

export default async function TemplatesAdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth()
  if (!auth.authorized) redirect('/login')
  const isAdmin = auth.roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r))
  if (!isAdmin) redirect('/dashboard')
  return <>{children}</>
}
