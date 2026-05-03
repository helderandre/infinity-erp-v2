// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

// Mapping per spec: Vendedor side covers listing-side perspectives,
// Comprador side covers buyer/tenant-side perspectives.
const VENDEDOR_TIPOS = ['Vendedor', 'Senhorio']
const COMPRADOR_TIPOS = ['Comprador', 'Arrendatário']

interface SideStats {
  avg_days: number | null
  count: number
}

// GET /api/agent-goals/avg-close-time?agent_id=<uuid>&window_months=12
// Returns the agent's average time-to-close for closed deals (won_date set),
// split by listing side (Vendedor/Senhorio) and buyer side (Comprador/Arrendatário).
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const agentParam = searchParams.get('agent_id')
    const windowMonthsRaw = parseInt(searchParams.get('window_months') ?? '12', 10)
    const windowMonths = Number.isFinite(windowMonthsRaw) ? Math.max(1, Math.min(60, windowMonthsRaw)) : 12

    const canSeeAll = isManagementRole(auth.roles)
    const agent_id = canSeeAll && agentParam ? agentParam : auth.user.id

    const since = new Date()
    since.setMonth(since.getMonth() - windowMonths)

    const { data: rows, error } = await supabase
      .from('negocios')
      .select('tipo, created_at, won_date')
      .eq('assigned_consultant_id', agent_id)
      .not('won_date', 'is', null)
      .gte('won_date', since.toISOString())

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const tally = (rows ?? []).reduce<{
      vendedor: { sum: number; count: number }
      comprador: { sum: number; count: number }
    }>(
      (acc, r) => {
        if (!r.won_date || !r.created_at) return acc
        const ms = new Date(r.won_date).getTime() - new Date(r.created_at).getTime()
        if (!Number.isFinite(ms) || ms <= 0) return acc
        const days = ms / 86400_000

        if (VENDEDOR_TIPOS.includes(r.tipo)) {
          acc.vendedor.sum += days
          acc.vendedor.count += 1
        } else if (COMPRADOR_TIPOS.includes(r.tipo)) {
          acc.comprador.sum += days
          acc.comprador.count += 1
        }
        return acc
      },
      { vendedor: { sum: 0, count: 0 }, comprador: { sum: 0, count: 0 } }
    )

    const toStats = (s: { sum: number; count: number }): SideStats => ({
      avg_days: s.count > 0 ? Math.round((s.sum / s.count) * 10) / 10 : null,
      count: s.count,
    })

    return NextResponse.json({
      data: {
        window_months: windowMonths,
        vendedor: toStats(tally.vendedor),
        comprador: toStats(tally.comprador),
      },
    })
  } catch (error) {
    console.error('Erro ao calcular tempo médio até fecho:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
