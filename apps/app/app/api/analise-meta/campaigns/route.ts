/**
 * GET /api/analise-meta/campaigns?q=&page=
 *
 * Paginated, searchable Meta campaign list (cards grid) for the CRM →
 * Análise → Meta tab. Management-only — mirrors the standalone Análise Meta
 * page, which reads the whole `meta` schema with the admin client.
 */

import { NextResponse } from 'next/server'

import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { listMetaCampaigns } from '@/lib/meta/campaign-queries'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    if (!isManagementRole(auth.roles)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? ''
    const page = Math.max(1, Number(searchParams.get('page')) || 1)

    const supabase = createCrmAdminClient()
    const { campaigns, total } = await listMetaCampaigns(supabase, { q, page, pageSize: PAGE_SIZE })

    return NextResponse.json({ campaigns, total, page, page_size: PAGE_SIZE })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro a carregar campanhas.' },
      { status: 500 },
    )
  }
}
