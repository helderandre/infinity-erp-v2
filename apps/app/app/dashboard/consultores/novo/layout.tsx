import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

// Criação de consultores é só para gestão (admin/Broker/CEO/Gestor
// Processual/Office Manager/Team Leader). Consultor regular vê a equipa
// mas não a cria.
export default async function NovoConsultorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await requireAuth()
  if (!auth.authorized) redirect('/login')
  if (!isManagementRole(auth.roles)) redirect('/dashboard/consultores')
  return <>{children}</>
}
