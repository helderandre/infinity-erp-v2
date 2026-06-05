// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { calcSellerFunnel, calcBuyerFunnel } from '@/lib/goals/calculations'
import type { ConsultantGoal } from '@/types/goal'

/**
 * GET /api/goals/weekly-reports/team
 * Team weekly overview — all consultants' reports + activities + lead sources + pipeline values
 * Query: ?week_start=YYYY-MM-DD (defaults to current week's Monday)
 */
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)

    // Calculate Monday of requested or current week
    let weekStart = searchParams.get('week_start')
    if (!weekStart) {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(now)
      monday.setDate(now.getDate() + mondayOffset)
      weekStart = monday.toISOString().split('T')[0]
    }

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    const year = new Date(weekStart).getFullYear()

    const supabase = await createClient()

    // 1. Get all active goals for this year
    const { data: goals } = await supabase
      .from('temp_consultant_goals')
      .select(`
        *,
        consultant:dev_users!temp_consultant_goals_consultant_id_fkey(
          id, commercial_name
        )
      `)
      .eq('year', year)
      .eq('is_active', true)

    if (!goals || goals.length === 0) {
      return NextResponse.json({ week_start: weekStart, week_end: weekEndStr, reports: [] })
    }

    const consultantIds = goals.map(g => g.consultant_id)

    // 2. Get weekly reports
    const { data: reports } = await supabase
      .from('weekly_reports')
      .select('*')
      .in('consultant_id', consultantIds)
      .eq('week_start', weekStart)

    // 3. Get activities for the week
    const { data: activities } = await supabase
      .from('temp_goal_activity_log')
      .select('consultant_id, activity_type, origin_type, quantity')
      .in('consultant_id', consultantIds)
      .gte('activity_date', weekStart)
      .lte('activity_date', weekEndStr)

    // 4. Get lead sources for this week (leads assigned to these consultants, created this week)
    const { data: weekLeads } = await supabase
      .from('leads')
      .select('agent_id, origem, first_source')
      .in('agent_id', consultantIds)
      .gte('created_at', weekStart)
      .lte('created_at', weekEndStr + 'T23:59:59')

    // 5. Get active pipeline deals per consultant for commission calculation
    // Venda/Arrendador: preco_venda or orcamento → × 5% (sale) or renda × 150% (rent)
    // Compra/Arrendatário: orcamento or orcamento_max → × 5% (buy) or renda_max_mensal × 150% (rent)
    const { data: deals } = await supabase
      .from('negocios')
      .select('assigned_consultant_id, tipo, preco_venda, orcamento, orcamento_max, renda_max_mensal, renda_pretendida, estado')
      .in('assigned_consultant_id', consultantIds)
      .not('estado', 'in', '("Fechado","Cancelado","Perdido")')

    const acts = activities || []
    const reportMap = new Map((reports || []).map(r => [r.consultant_id, r]))

    // Build lead source map per consultant
    const leadSourceMap = new Map<string, Record<string, number>>()
    for (const lead of (weekLeads || [])) {
      const cid = lead.agent_id
      if (!cid) continue
      const source = lead.first_source || lead.origem || 'other'
      if (!leadSourceMap.has(cid)) leadSourceMap.set(cid, {})
      const map = leadSourceMap.get(cid)!
      map[source] = (map[source] || 0) + 1
    }

    // Build pipeline value map per consultant
    const pipelineMap = new Map<string, { compra: number; venda: number; arrendamento: number }>()
    for (const deal of (deals || [])) {
      const cid = deal.assigned_consultant_id
      if (!cid) continue
      if (!pipelineMap.has(cid)) pipelineMap.set(cid, { compra: 0, venda: 0, arrendamento: 0 })
      const pv = pipelineMap.get(cid)!
      const tipo = (deal.tipo || '').toLowerCase()

      if (tipo.includes('venda') || tipo === 'arrendador') {
        if (tipo === 'arrendador') {
          // Rent commission: monthly rent × 150%
          const rent = deal.renda_pretendida || 0
          pv.arrendamento += rent * 1.5
        } else {
          // Sale commission: price × 5%
          const price = deal.preco_venda || deal.orcamento || 0
          pv.venda += price * 0.05
        }
      }

      if (tipo.includes('compra') || tipo === 'arrendatário') {
        if (tipo === 'arrendatário') {
          // Rent commission: max rent × 150%
          const rent = deal.renda_max_mensal || 0
          pv.arrendamento += rent * 1.5
        } else {
          // Buy commission: budget × 5%
          const budget = deal.orcamento_max || deal.orcamento || 0
          pv.compra += budget * 0.05
        }
      }
    }

    // 6. Build enriched rows per consultant
    const rows = goals.map(goal => {
      const g = goal as unknown as ConsultantGoal
      const sellerFunnel = calcSellerFunnel(g)
      const buyerFunnel = calcBuyerFunnel(g)

      const consultantActs = acts.filter(a => a.consultant_id === goal.consultant_id)
      const systemCount = consultantActs.filter(a => a.origin_type === 'system').reduce((s, a) => s + (a.quantity || 1), 0)
      const declaredCount = consultantActs.filter(a => a.origin_type === 'declared').reduce((s, a) => s + (a.quantity || 1), 0)
      const totalCount = systemCount + declaredCount

      const countByType = (type: string) => {
        const typeActs = consultantActs.filter(a => a.activity_type === type)
        const system = typeActs.filter(a => a.origin_type === 'system').reduce((s, a) => s + (a.quantity || 1), 0)
        const declared = typeActs.filter(a => a.origin_type === 'declared').reduce((s, a) => s + (a.quantity || 1), 0)
        return { done: system + declared, system, declared }
      }

      const byType = {
        lead_contact: { ...countByType('lead_contact'), target: Math.ceil(sellerFunnel.weekly.leads + buyerFunnel.weekly.leads) },
        call: { ...countByType('call'), target: Math.ceil(sellerFunnel.weekly.calls + buyerFunnel.weekly.calls) },
        visit: { ...countByType('visit'), target: Math.ceil(sellerFunnel.weekly.visits) },
        listing: { ...countByType('listing'), target: Math.ceil(sellerFunnel.weekly.listings) },
        follow_up: { ...countByType('follow_up'), target: Math.ceil((sellerFunnel.weekly.leads + buyerFunnel.weekly.leads) * 0.5) },
      }

      const report = reportMap.get(goal.consultant_id)

      // Lead sources for this consultant
      const sourceMap = leadSourceMap.get(goal.consultant_id) || {}
      const leadSources = Object.entries(sourceMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)

      // Pipeline values
      const pv = pipelineMap.get(goal.consultant_id) || { compra: 0, venda: 0, arrendamento: 0 }
      const pipelineValue = {
        ...pv,
        total: pv.compra + pv.venda + pv.arrendamento,
      }

      return {
        consultant_id: goal.consultant_id,
        commercial_name: (goal.consultant as any)?.commercial_name || '',
        report: report || null,
        activities: {
          total: totalCount,
          system: systemCount,
          declared: declaredCount,
          by_type: byType,
        },
        trust_ratio: totalCount > 0 ? systemCount / totalCount : 1,
        pipeline_value: pipelineValue,
        lead_sources: leadSources,
      }
    })

    // Sort: submitted first, then by name
    rows.sort((a, b) => {
      const aSubmitted = a.report?.status === 'submitted' || a.report?.status === 'reviewed' ? 1 : 0
      const bSubmitted = b.report?.status === 'submitted' || b.report?.status === 'reviewed' ? 1 : 0
      if (aSubmitted !== bSubmitted) return bSubmitted - aSubmitted
      return a.commercial_name.localeCompare(b.commercial_name)
    })

    return NextResponse.json({
      week_start: weekStart,
      week_end: weekEndStr,
      reports: rows,
    })
  } catch (error) {
    console.error('Erro ao obter visão de equipa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
