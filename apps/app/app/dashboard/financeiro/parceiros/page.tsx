import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/permissions'
import { PartnerLedgerOverview } from '@/components/partner-ledger/partner-ledger-overview'

// Conta corrente de parceiros (gestão). Comissões de referência confirmadas
// pela gestão + pagamentos; saldo por parceiro. Acesso: financial OU users.
export default async function ParceirosContaCorrentePage() {
  const auth = await requireAuth()
  if (!auth.authorized) redirect('/login')

  const isManagement = auth.permissions.financial === true || auth.permissions.users === true
  if (!isManagement) redirect('/dashboard/financeiro')

  return <PartnerLedgerOverview />
}
