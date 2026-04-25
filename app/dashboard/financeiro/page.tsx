import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { VistaConsultor } from '@/components/financial/consultor/vista-consultor'

// Root da secção Financeiro.
//
// Branching por role (decisão A — usar permissions.users como proxy de "gestão"):
//   - Empresa (broker / office manager / quem tenha permissions.users):
//       redirect para /dashboard/financeiro/dashboard (vista global existente).
//       Será substituído pela Vista Empresa unificada na Fase 3.
//   - Consultor:
//       renderiza <VistaConsultor> com 4 tabs (Resumo / Comissões /
//       Compras na loja / Conta corrente). Deep-link via ?tab=.
export default async function FinanceiroRootPage() {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const isEmpresa = auth.permissions.users === true
  if (isEmpresa) {
    redirect('/dashboard/financeiro/dashboard')
  }

  const supabase = await createClient()
  const { data: me } = await (supabase as any)
    .from('dev_users')
    .select('id, commercial_name')
    .eq('id', auth.user.id)
    .single()

  return (
    <VistaConsultor
      agentId={auth.user.id}
      agentName={me?.commercial_name ?? null}
    />
  )
}
