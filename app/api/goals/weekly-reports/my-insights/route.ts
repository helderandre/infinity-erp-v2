// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

/**
 * GET /api/goals/weekly-reports/my-insights
 * Returns the current user's pipeline commission values and lead sources for a given week.
 * Query: ?week_start=YYYY-MM-DD
 */
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('week_start')

    if (!weekStart) {
      return NextResponse.json({ error: 'week_start é obrigatório' }, { status: 400 })
    }

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    const userId = auth.user.id
    const supabase = await createClient()

    // 1. Pipeline values — active deals assigned to this consultant
    const { data: deals } = await supabase
      .from('negocios')
      .select('tipo, preco_venda, orcamento, orcamento_max, renda_max_mensal, renda_pretendida, estado')
      .eq('assigned_consultant_id', userId)
      .not('estado', 'in', '("Fechado","Cancelado","Perdido")')

    const pv = { compra: 0, venda: 0, arrendamento: 0 }

    for (const deal of (deals || [])) {
      const tipo = (deal.tipo || '').toLowerCase()

      if (tipo.includes('venda') || tipo === 'arrendador') {
        if (tipo === 'arrendador') {
          pv.arrendamento += (deal.renda_pretendida || 0) * 1.5
        } else {
          pv.venda += (deal.preco_venda || deal.orcamento || 0) * 0.05
        }
      }

      if (tipo.includes('compra') || tipo === 'arrendatário') {
        if (tipo === 'arrendatário') {
          pv.arrendamento += (deal.renda_max_mensal || 0) * 1.5
        } else {
          pv.compra += (deal.orcamento_max || deal.orcamento || 0) * 0.05
        }
      }
    }

    // 2. Lead sources — leads assigned to this consultant, created this week
    const { data: weekLeads } = await supabase
      .from('leads')
      .select('origem, first_source')
      .eq('agent_id', userId)
      .gte('created_at', weekStart)
      .lte('created_at', weekEndStr + 'T23:59:59')

    const sourceMap: Record<string, number> = {}
    for (const lead of (weekLeads || [])) {
      const source = lead.first_source || lead.origem || 'other'
      sourceMap[source] = (sourceMap[source] || 0) + 1
    }

    const leadSources = Object.entries(sourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      pipeline_value: {
        ...pv,
        total: pv.compra + pv.venda + pv.arrendamento,
      },
      lead_sources: leadSources,
    })
  } catch (error) {
    console.error('Erro ao obter insights:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
