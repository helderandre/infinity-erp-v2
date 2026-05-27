/**
 * GET /api/leads/distribution
 *
 * Aggregates the caller's lead entries by source (Meta, referência, website…)
 * and by lifecycle status, for the Distribuição tab. Scoped to own entries;
 * management sees all (optional ?consultant_id=).
 */

import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = (await createClient()) as any
    const { searchParams } = new URL(request.url)
    const canSeeAll = isManagementRole(auth.roles)
    const consultantId = canSeeAll
      ? searchParams.get('consultant_id')
      : auth.user.id

    let query = supabase
      .from('leads_entries')
      .select('source, status, has_referral')
      .limit(5000)
    if (consultantId) query = query.eq('assigned_consultant_id', consultantId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? []) as Array<{ source: string | null; status: string | null; has_referral: boolean | null }>

    const bySource: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    let withReferral = 0
    for (const r of rows) {
      const src = r.source ?? 'other'
      bySource[src] = (bySource[src] ?? 0) + 1
      const st = r.status ?? 'new'
      byStatus[st] = (byStatus[st] ?? 0) + 1
      if (r.has_referral) withReferral++
    }

    return NextResponse.json({
      total: rows.length,
      with_referral: withReferral,
      by_source: bySource,
      by_status: byStatus,
    })
  } catch (err) {
    console.error('Erro em /api/leads/distribution:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
