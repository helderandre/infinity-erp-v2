import { requireAuth } from '@/lib/auth/permissions'
import { ContaCorrenteEmpresaClient } from '@/components/financial/conta-corrente/conta-corrente-empresa-client'
import { ContaCorrenteUnified } from '@/components/financial/conta-corrente/conta-corrente-unified'

// Conta Corrente unificada — página própria (acessível pela sidebar).
//
// - Empresa (permissions.users): top-tabs Individual / Geral
//     · Individual: scope picker (Empresa | consultor) + ledger unificado com 3 sub-tabs
//     · Geral: tabela com todos os consultores e respectivos KPIs
// - Consultor: locked à própria CC, com os 3 sub-tabs (Tudo / Comissões / Despesas).
export default async function ContaCorrentePage() {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const isEmpresa = auth.permissions.users === true

  if (isEmpresa) {
    return <ContaCorrenteEmpresaClient />
  }

  return <ContaCorrenteUnified scope={{ kind: 'agent', agentId: auth.user.id }} />
}
