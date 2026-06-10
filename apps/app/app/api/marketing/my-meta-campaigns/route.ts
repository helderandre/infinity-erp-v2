import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { isPartner, isManagementRole } from '@/lib/auth/roles'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { listMetaCampaigns } from '@/lib/meta/campaign-queries'
import {
  getPartnerCampaignIds,
  getAllPartnerReferencedCampaignIds,
} from '@/lib/meta/partner-campaign-scope'

export const dynamic = 'force-dynamic'

// GET — as campanhas Meta que o parceiro gere/referencia (derivadas das suas
// leads_assignment_rules), já com desempenho ao vivo (investimento, leads,
// anúncios). Alimenta a tab "Campanhas" do portal de parceiros.
//
// Ao contrário da tab antiga (que só mostrava pedidos já ligados a uma campanha
// Meta), esta surfaça TODAS as campanhas que o parceiro referencia, ligadas ou
// não a um pedido — é por aqui que as 2 campanhas do parceiro aparecem.
export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const canSeeAll =
      isManagementRole(auth.roles) ||
      auth.permissions.users === true ||
      auth.permissions.marketing === true
    if (!canSeeAll && !isPartner(auth.roles)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const supabase = createCrmAdminClient()
    // Parceiro → as campanhas que ELE referencia. Gestão/admin a ver o portal
    // (não é parceiro, não referencia nada) → todas as campanhas referenciadas
    // por qualquer parceiro, para poder validar/supervisionar.
    const campaignIds = canSeeAll
      ? await getAllPartnerReferencedCampaignIds(supabase)
      : await getPartnerCampaignIds(supabase, auth.user.id)

    const { campaigns } = await listMetaCampaigns(supabase, {
      page: 1,
      pageSize: 100,
      campaignIds,
    })

    return NextResponse.json(
      campaigns.map((c) => ({
        campaign_id: c.campaign_id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        daily_budget: c.daily_budget,
        spend: c.spend,
        currency: c.currency,
        leads_count: c.leads_count,
        ads_count: c.ads_count,
        fb_created_time: c.fb_created_time,
      })),
    )
  } catch (error) {
    console.error('Erro ao listar campanhas Meta do parceiro:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
