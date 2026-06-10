import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { isPartner, isManagementRole } from '@/lib/auth/roles'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { listMetaCampaigns } from '@/lib/meta/campaign-queries'
import { getPartnerCampaignIds } from '@/lib/meta/partner-campaign-scope'

export const dynamic = 'force-dynamic'

// GET — opções de campanhas Meta sincronizadas (campaign_id + nome + estado)
// para o parceiro escolher ao ligar uma campanha-pedido à campanha Meta real.
// Acesso: parceiros (que executam as campanhas) e gestão.
//
// Scope: a gestão (management / marketing / users) vê todas as campanhas; um
// parceiro só vê as que gere/referencia — derivadas das suas
// leads_assignment_rules (referral_consultant_id = self).
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const canSeeAll =
      isManagementRole(auth.roles) ||
      auth.permissions.users === true ||
      auth.permissions.marketing === true
    const allowed = canSeeAll || isPartner(auth.roles)
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? ''

    const supabase = createCrmAdminClient()
    // Partners are scoped to the campaigns they reference; management sees all.
    const campaignIds = canSeeAll
      ? undefined
      : await getPartnerCampaignIds(supabase, auth.user.id)

    const { campaigns } = await listMetaCampaigns(supabase, { q, page: 1, pageSize: 50, campaignIds })

    return NextResponse.json(
      campaigns.map((c) => ({
        campaign_id: c.campaign_id,
        name: c.name,
        status: c.status,
        leads_count: c.leads_count,
        fb_created_time: c.fb_created_time,
      })),
    )
  } catch (error) {
    console.error('Erro ao listar opções de campanhas Meta:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
