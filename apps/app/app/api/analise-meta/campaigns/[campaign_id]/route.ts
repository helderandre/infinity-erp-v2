/**
 * GET /api/analise-meta/campaigns/[campaign_id]
 *
 * Full campaign detail payload (header + summary KPIs + adset/ad funnel +
 * insight KPIs) for the inline drill-in in the CRM → Análise → Meta tab.
 * Management-only — same audience as the standalone Análise Meta page.
 */

import { NextResponse } from 'next/server'

import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { getMetaCampaignDetail } from '@/lib/meta/campaign-queries'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaign_id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    if (!isManagementRole(auth.roles)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { campaign_id } = await params
    const supabase = createCrmAdminClient()
    const detail = await getMetaCampaignDetail(supabase, campaign_id)

    if (!detail) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro a carregar campanha.' },
      { status: 500 },
    )
  }
}
