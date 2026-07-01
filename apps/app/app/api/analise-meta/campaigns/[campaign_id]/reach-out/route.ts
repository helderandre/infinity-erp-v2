/**
 * GET /api/analise-meta/campaigns/[campaign_id]/reach-out
 *
 * Reach-out performance for a campaign's CRM leads: time-to-first-contact,
 * leads still waiting, and conversion to won deals. Powers the "Leads" and
 * "Reach-out" tabs of the campaign detail. Management-only (same as detail).
 */

import { NextResponse } from 'next/server'

import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { getCampaignReachOut } from '@/lib/meta/campaign-reachout'
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
    const data = await getCampaignReachOut(supabase, campaign_id, range)

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro a carregar desempenho.' },
      { status: 500 },
    )
  }
}
