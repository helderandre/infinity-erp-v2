// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { calcFinancial, calcSellerFunnel, calcBuyerFunnel, calcRealityCheck, getGoalStatus } from '@/lib/goals/calculations'
import type { ConsultantGoal } from '@/types/goal'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    // 1. Get the goal
    const { data: goal, error: goalError } = await supabase
      .from('temp_consultant_goals')
      .select(`
        *,
        consultant:dev_users!temp_consultant_goals_consultant_id_fkey(
          id, commercial_name
        )
      `)
      .eq('id', id)
      .single()

    if (goalError || !goal) {
      return NextResponse.json({ error: 'Objetivo não encontrado' }, { status: 404 })
    }

    // 2. Get activities for this year to compute "realizado"
    const { data: activities } = await supabase
      .from('temp_goal_activity_log')
      .select('activity_type, origin, revenue_amount, activity_date')
      .eq('consultant_id', goal.consultant_id)
      .gte('activity_date', `${goal.year}-01-01`)
      .lte('activity_date', `${goal.year}-12-31`)

    const acts = activities || []

    // Aggregate realized
    const totalRealized = acts
      .filter(a => a.revenue_amount && (a.activity_type === 'sale_close' || a.activity_type === 'buyer_close'))
      .reduce((sum, a) => sum + (a.revenue_amount || 0), 0)

    // 3. Calculate all KPIs
    const financial = calcFinancial(goal as ConsultantGoal)
    const funnel_sellers = calcSellerFunnel(goal as ConsultantGoal)
    const funnel_buyers = calcBuyerFunnel(goal as ConsultantGoal)
    const reality_check = calcRealityCheck(goal as ConsultantGoal, totalRealized)

    // 4. Today's actions — aggregate today's activities vs daily targets
    const today = new Date().toISOString().split('T')[0]
    const todayActs = acts.filter(a => a.activity_date === today)

    const todayLeads = todayActs.filter(a => a.activity_type === 'lead_contact').length
    const todayCalls = todayActs.filter(a => a.activity_type === 'call').length
    const todayVisits = todayActs.filter(a => a.activity_type === 'visit').length
    const todayFollowUps = todayActs.filter(a => a.activity_type === 'follow_up').length

    const dailySellerLeads = funnel_sellers.daily.leads
    const dailyBuyerLeads = funnel_buyers.daily.leads
    const dailyTotalLeads = dailySellerLeads + dailyBuyerLeads

    const dailySellerCalls = funnel_sellers.daily.calls
    const dailyBuyerCalls = funnel_buyers.daily.calls
    const dailyTotalCalls = dailySellerCalls + dailyBuyerCalls

    const dailyVisitsTarget = funnel_sellers.daily.visits + funnel_buyers.daily.leads * 0 // visits only for sellers
    const dailyVisitsTargetFinal = funnel_sellers.daily.visits

    const todayData = {
      leads_to_contact: Math.ceil(dailyTotalLeads),
      calls_minimum: Math.ceil(dailyTotalCalls),
      visits_to_schedule: Math.ceil(dailyVisitsTargetFinal),
      follow_ups: Math.ceil(dailyTotalLeads * 0.5), // heuristic: ~50% of leads need follow-up
      status: {
        leads: getGoalStatus(todayLeads, Math.ceil(dailyTotalLeads)),
        calls: getGoalStatus(todayCalls, Math.ceil(dailyTotalCalls)),
        visits: getGoalStatus(todayVisits, Math.ceil(dailyVisitsTargetFinal)),
        follow_ups: getGoalStatus(todayFollowUps, Math.ceil(dailyTotalLeads * 0.5)),
      },
    }

    // 5. Weekly progress for current week
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset)
    const mondayStr = monday.toISOString().split('T')[0]
    const sundayDate = new Date(monday)
    sundayDate.setDate(monday.getDate() + 6)
    const sundayStr = sundayDate.toISOString().split('T')[0]

    const weekActs = acts.filter(a => a.activity_date >= mondayStr && a.activity_date <= sundayStr)
    const weekRevenue = weekActs
      .filter(a => a.revenue_amount && (a.activity_type === 'sale_close' || a.activity_type === 'buyer_close'))
      .reduce((sum, a) => sum + (a.revenue_amount || 0), 0)

    // Monthly
    const monthStr = `${goal.year}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthActs = acts.filter(a => a.activity_date.startsWith(monthStr))
    const monthRevenue = monthActs
      .filter(a => a.revenue_amount && (a.activity_type === 'sale_close' || a.activity_type === 'buyer_close'))
      .reduce((sum, a) => sum + (a.revenue_amount || 0), 0)

    return NextResponse.json({
      goal,
      financial,
      funnel_sellers,
      funnel_buyers,
      reality_check,
      today: todayData,
      progress: {
        annual: { realized: totalRealized, target: financial.annual.total },
        monthly: { realized: monthRevenue, target: financial.monthly.total },
        weekly: { realized: weekRevenue, target: financial.weekly.total },
      },
    })
  } catch (error) {
    console.error('Erro ao calcular dashboard:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
