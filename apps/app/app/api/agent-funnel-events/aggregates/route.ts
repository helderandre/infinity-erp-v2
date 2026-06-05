// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import type { FunnelAggregates, FunnelSide, FunnelStage, StageCounts } from '@/types/funnel-event'

// GET /api/agent-funnel-events/aggregates?agent_id=X&since=ISO[&until=ISO]
// Returns counts grouped by (side, stage) within the time window.
// Defaults: agent = caller, since = start of current year, until = now.
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const agentParam = searchParams.get('agent_id')
    const sinceParam = searchParams.get('since')
    const untilParam = searchParams.get('until')

    const canSeeAll = isManagementRole(auth.roles)
    const agent_id = canSeeAll && agentParam ? agentParam : auth.user.id

    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString()
    const since = sinceParam ?? startOfYear
    const until = untilParam ?? now.toISOString()

    const { data: rows, error } = await supabase
      .from('agent_funnel_events')
      .select('side, stage, count, source')
      .eq('agent_id', agent_id)
      .gte('occurred_at', since)
      .lte('occurred_at', until)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const counts: Record<FunnelSide, Partial<Record<FunnelStage, StageCounts>>> = {
      vendedor: {},
      comprador: {},
    }

    for (const r of rows ?? []) {
      const side = r.side as FunnelSide
      const stage = r.stage as FunnelStage
      const inc = r.count ?? 0
      const isManual = r.source === 'manual'
      const bucket = counts[side][stage] ?? { total: 0, manual: 0 }
      bucket.total += inc
      if (isManual) bucket.manual += inc
      counts[side][stage] = bucket
    }

    const result: FunnelAggregates = {
      counts,
      window_start: since,
      window_end: until,
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Erro ao agregar funnel events:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
