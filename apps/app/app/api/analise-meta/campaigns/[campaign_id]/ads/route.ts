/**
 * GET /api/analise-meta/campaigns/[campaign_id]/ads
 *
 * A campaign's ads grouped by adset (campaign → adset → ad), each ad + each
 * adset group enriched with insight totals (spend/impressions/clicks/CTR/CPL)
 * and lead counts. Powers the lazy accordion expansion under a campaign row in
 * the CRM → Análise → Meta tab (mirrors the Meta Ads page funnel).
 *
 * Management-only — reads the whole `meta` schema with the admin client.
 */

import { NextResponse } from 'next/server'

import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { listCampaignAdsetGroups } from '@/lib/meta/campaign-queries'
import { parseDateRange } from '@/lib/meta/date-range'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaign_id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    if (!isManagementRole(auth.roles)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { campaign_id } = await params
    const range = parseDateRange(new URL(request.url).searchParams)
    const supabase = createCrmAdminClient()
    const adsetGroups = await listCampaignAdsetGroups(supabase, campaign_id, range)

    return NextResponse.json({ adsetGroups })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro a carregar anúncios.' },
      { status: 500 },
    )
  }
}
