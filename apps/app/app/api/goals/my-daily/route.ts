// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { calcFinancial, calcSellerFunnel, calcBuyerFunnel, calcRealityCheck, getGoalStatus } from '@/lib/goals/calculations'
import type { ConsultantGoal, GoalStatus } from '@/types/goal'

/**
 * GET /api/goals/my-daily
 *
 * Returns the current user's daily objectives for today.
 * Used by the daily goals popup notification.
 */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const currentYear = new Date().getFullYear()
    const today = new Date().toISOString().split('T')[0]

    // Get goal for current user + current year
    const { data: goal, error } = await supabase
      .from('temp_consultant_goals')
      .select('*')
      .eq('consultant_id', auth.user.id)
      .eq('year', currentYear)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!goal) {
      return NextResponse.json({ hasGoal: false })
    }

    const g = goal as unknown as ConsultantGoal

    // Calculate targets
    const financial = calcFinancial(g)
    const sellerFunnel = calcSellerFunnel(g)
    const buyerFunnel = calcBuyerFunnel(g)

    // Get today's activities
    const { data: todayActs } = await supabase
      .from('temp_goal_activity_log')
      .select('activity_type, origin, revenue_amount')
      .eq('consultant_id', auth.user.id)
      .eq('activity_date', today)

    const acts = todayActs || []

    // Get year-to-date revenue for reality check
    const { data: yearActs } = await supabase
      .from('temp_goal_activity_log')
      .select('activity_type, revenue_amount')
      .eq('consultant_id', auth.user.id)
      .gte('activity_date', `${currentYear}-01-01`)
      .lte('activity_date', `${currentYear}-12-31`)
      .in('activity_type', ['sale_close', 'buyer_close'])

    const totalRealized = (yearActs || [])
      .reduce((sum, a) => sum + (a.revenue_amount || 0), 0)

    const realityCheck = calcRealityCheck(g, totalRealized)

    // Daily targets
    const dailyLeads = Math.ceil(sellerFunnel.daily.leads + buyerFunnel.daily.leads)
    const dailyCalls = Math.ceil(sellerFunnel.daily.calls + buyerFunnel.daily.calls)
    const dailyVisits = Math.ceil(sellerFunnel.daily.visits)
    const dailyFollowUps = Math.ceil((sellerFunnel.daily.leads + buyerFunnel.daily.leads) * 0.5)

    // Today's done
    const doneLeads = acts.filter(a => a.activity_type === 'lead_contact').length
    const doneCalls = acts.filter(a => a.activity_type === 'call').length
    const doneVisits = acts.filter(a => a.activity_type === 'visit').length
    const doneFollowUps = acts.filter(a => a.activity_type === 'follow_up').length

    const actions: { key: string; label: string; target: number; done: number; status: GoalStatus }[] = [
      { key: 'leads', label: 'Leads a contactar', target: dailyLeads, done: doneLeads, status: getGoalStatus(doneLeads, dailyLeads) },
      { key: 'calls', label: 'Chamadas', target: dailyCalls, done: doneCalls, status: getGoalStatus(doneCalls, dailyCalls) },
      { key: 'visits', label: 'Visitas', target: dailyVisits, done: doneVisits, status: getGoalStatus(doneVisits, dailyVisits) },
      { key: 'follow_ups', label: 'Follow-ups', target: dailyFollowUps, done: doneFollowUps, status: getGoalStatus(doneFollowUps, dailyFollowUps) },
    ]

    return NextResponse.json({
      hasGoal: true,
      goalId: goal.id,
      dailyRevenue: financial.daily.total,
      weeklyRevenue: financial.weekly.total,
      annualTarget: financial.annual.total,
      realizedToday: acts
        .filter(a => a.revenue_amount && (a.activity_type === 'sale_close' || a.activity_type === 'buyer_close'))
        .reduce((s, a) => s + (a.revenue_amount || 0), 0),
      overallStatus: realityCheck.status,
      projectionMessage: realityCheck.message,
      actions,
    })
  } catch (error) {
    console.error('Erro ao obter objetivos diários:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
