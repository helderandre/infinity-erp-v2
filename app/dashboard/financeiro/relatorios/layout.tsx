import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/permissions'

// Relatórios Financeiros é uma área de gestão; consultores não têm acesso.
// O gate `commissions` herdado da layout-pai não chega — a maioria dos
// consultores tem essa permissão para ver os próprios dados.
export default async function RelatoriosFinanceirosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response
  if (auth.permissions.users !== true) redirect('/dashboard')
  return <>{children}</>
}
