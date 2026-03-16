// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { calcFinancial, calcSellerFunnel, calcBuyerFunnel, getGoalStatus } from '@/lib/goals/calculations'
import type { ConsultantGoal, GoalCompareRow } from '@/types/goal'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const year = Number(searchParams.get('year')) || new Date().getFullYear()
    const period = searchParams.get('period') || 'weekly' // weekly | monthly

    const supabase = await createClient()

    // 1. Get all active goals for year
    const { data: goals, error } = await supabase
      .from('temp_consultant_goals')
      .select(`
        *,
        consultant:dev_users!temp_consultant_goals_consultant_id_fkey(
          id, commercial_name
        )
      `)
      .eq('year', year)
      .eq('is_active', true)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!goals || goals.length === 0) return NextResponse.json({ data: [] })

    // 2. Determine date range for period
    const now = new Date()
    let dateFrom: string
    let dateTo: string

    if (period === 'weekly') {
      const dayOfWeek = now.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(now)
      monday.setDate(now.getDate() + mondayOffset)
      dateFrom = monday.toISOString().split('T')[0]
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      dateTo = sunday.toISOString().split('T')[0]
    } else {
      dateFrom = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
      dateTo = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`
    }

    // 3. Get all activities for this period
    const consultantIds = goals.map(g => g.consultant_id)
    const { data: activities } = await supabase
      .from('temp_goal_activity_log')
      .select('consultant_id, activity_type, origin, revenue_amount')
      .in('consultant_id', consultantIds)
      .gte('activity_date', dateFrom)
      .lte('activity_date', dateTo)

    const acts = activities || []

    // 4. Build comparison rows
    const rows: GoalCompareRow[] = goals.map(goal => {
      const g = goal as unknown as ConsultantGoal
      const financial = calcFinancial(g)
      const sellerFunnel = calcSellerFunnel(g)
      const buyerFunnel = calcBuyerFunnel(g)

      const target = period === 'weekly' ? financial.weekly.total : financial.monthly.total
      const consultantActs = acts.filter(a => a.consultant_id === goal.consultant_id)

      const realized = consultantActs
        .filter(a => a.revenue_amount && (a.activity_type === 'sale_close' || a.activity_type === 'buyer_close'))
        .reduce((sum, a) => sum + (a.revenue_amount || 0), 0)

      const leadsTarget = period === 'weekly'
        ? sellerFunnel.weekly.leads + buyerFunnel.weekly.leads
        : sellerFunnel.monthly.leads + buyerFunnel.monthly.leads
      const leadsDone = consultantActs.filter(a => a.activity_type === 'lead_contact').length

      const callsTarget = period === 'weekly'
        ? sellerFunnel.weekly.calls + buyerFunnel.weekly.calls
        : sellerFunnel.monthly.calls + buyerFunnel.monthly.calls
      const callsDone = consultantActs.filter(a => a.activity_type === 'call').length

      const visitsTarget = period === 'weekly'
        ? sellerFunnel.weekly.visits
        : sellerFunnel.monthly.visits
      const visitsDone = consultantActs.filter(a => a.activity_type === 'visit').length

      return {
        consultant_id: goal.consultant_id,
        commercial_name: (goal.consultant as any)?.commercial_name || '',
        profile_photo_url: null,
        target,
        realized,
        pct: target > 0 ? (realized / target) * 100 : 0,
        leads: { done: leadsDone, target: Math.ceil(leadsTarget) },
        calls: { done: callsDone, target: Math.ceil(callsTarget) },
        visits: { done: visitsDone, target: Math.ceil(visitsTarget) },
        status: getGoalStatus(realized, target),
      }
    })

    // Sort by pct descending
    rows.sort((a, b) => b.pct - a.pct)

    return NextResponse.json({ data: rows, period, dateFrom, dateTo })
  } catch (error) {
    console.error('Erro ao comparar objetivos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
