import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

// Detalhe completo do consultor (e respectivo /editar) só para gestão
// OU para o próprio consultor a ver/editar o seu perfil. Consultores
// regulares vêem a listagem + o Sheet de outros (sem dados privados).
export default async function ConsultorDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const auth = await requireAuth()
  if (!auth.authorized) redirect('/login')

  const { id } = await params
  const isSelf = id === auth.user.id
  const isManagement = isManagementRole(auth.roles)
  if (!isSelf && !isManagement) {
    redirect('/dashboard/consultores')
  }
  return <>{children}</>
}
