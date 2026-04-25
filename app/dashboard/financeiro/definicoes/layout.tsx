import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/permissions'

// Definições Financeiras é uma área de gestão; consultores não têm acesso.
export default async function DefinicoesFinanceirasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response
  if (auth.permissions.users !== true) redirect('/dashboard')
  return <>{children}</>
}
