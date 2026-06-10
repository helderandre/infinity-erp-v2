import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { isPartner, isManagementRole } from '@/lib/auth/roles'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { listMetaCampaigns } from '@/lib/meta/campaign-queries'

export const dynamic = 'force-dynamic'

// GET — opções de campanhas Meta sincronizadas (campaign_id + nome + estado)
// para o parceiro escolher ao ligar uma campanha-pedido à campanha Meta real.
// Acesso: parceiros (que executam as campanhas) e gestão.
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const allowed =
      isPartner(auth.roles) ||
      isManagementRole(auth.roles) ||
      auth.permissions.users === true ||
      auth.permissions.marketing === true
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? ''

    const { campaigns } = await listMetaCampaigns(createCrmAdminClient(), { q, page: 1, pageSize: 50 })

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
