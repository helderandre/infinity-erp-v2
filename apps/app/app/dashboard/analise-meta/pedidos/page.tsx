import { CampaignRequestsBoard } from '@/components/analise-meta/campaign-requests-board'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pedidos — Análise Meta' }

// Pipeline dos pedidos de campanha enviados aos parceiros de marketing —
// a mesma vista kanban que o parceiro trabalha no portal, aqui em modo de
// acompanhamento (a transição de estados pertence ao parceiro).
export default function PedidosMetaPage() {
  return <CampaignRequestsBoard />
}
