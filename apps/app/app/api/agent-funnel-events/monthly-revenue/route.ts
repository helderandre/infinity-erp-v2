// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

interface MonthlyBucket {
  month: number   // 1..12
  vendedor_eur: number
  comprador_eur: number
}

// GET /api/agent-funnel-events/monthly-revenue?agent_id=X&year=YYYY
// Returns 12-month cumulative revenue per side, derived from CPCV + Fecho events.
// Each event = half_commission_per_side (cash collected at signing or escritura).
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const agentParam = searchParams.get('agent_id')
    const yearParam = searchParams.get('year')
    const year = yearParam ? Number(yearParam) : new Date().getFullYear()

    const canSeeAll = isManagementRole(auth.roles)
    const agent_id = canSeeAll && agentParam ? agentParam : auth.user.id

    // Need agent's economics for revenue conversion
    const { data: goal, error: goalErr } = await supabase
      .from('agent_goals')
      .select('vendedor_avg_sale_value_eur, vendedor_commission_pct, comp_avg_purchase_value_eur, comp_commission_pct, annual_revenue_target_eur')
      .eq('agent_id', agent_id)
      .eq('period_year', year)
      .maybeSingle()

    if (goalErr) {
      return NextResponse.json({ error: goalErr.message }, { status: 500 })
    }

    const annualTarget = goal?.annual_revenue_target_eur ?? 0
    const vendHalfPerClose = goal
      ? (goal.vendedor_avg_sale_value_eur * (goal.vendedor_commission_pct / 100) * 0.5) / 2
      : 0
    const compHalfPerClose = goal
      ? (goal.comp_avg_purchase_value_eur * (goal.comp_commission_pct / 100) * 0.5) / 2
      : 0

    const yearStart = new Date(year, 0, 1).toISOString()
    const yearEnd = new Date(year + 1, 0, 1).toISOString()

    const { data: rows, error } = await supabase
      .from('agent_funnel_events')
      .select('side, stage, count, occurred_at')
      .eq('agent_id', agent_id)
      .in('stage', ['cpcv', 'fecho'])
      .gte('occurred_at', yearStart)
      .lt('occurred_at', yearEnd)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Initialise 12 monthly buckets
    const months: MonthlyBucket[] = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      vendedor_eur: 0,
      comprador_eur: 0,
    }))

    for (const r of rows ?? []) {
      const d = new Date(r.occurred_at)
      const mIdx = d.getMonth()
      const half = r.side === 'vendedor' ? vendHalfPerClose : compHalfPerClose
      const inc = (r.count ?? 0) * half
      if (r.side === 'vendedor') months[mIdx].vendedor_eur += inc
      else if (r.side === 'comprador') months[mIdx].comprador_eur += inc
    }

    return NextResponse.json({
      data: {
        year,
        annual_target_eur: annualTarget,
        months,
      },
    })
  } catch (error) {
    console.error('Erro ao agregar monthly-revenue:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
