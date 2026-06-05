// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { startOfWeek, subWeeks, format, startOfMonth, endOfMonth, subDays } from 'date-fns'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Get the goal
    const { data: goal, error: goalError } = await supabase
      .from('temp_consultant_goals')
      .select('*')
      .eq('id', id)
      .single()

    if (goalError || !goal) {
      return NextResponse.json({ error: 'Objectivo não encontrado' }, { status: 404 })
    }

    const period = searchParams.get('period') || 'month' // week, month, year
    const now = new Date()
    let dateFrom: string
    let dateTo: string

    switch (period) {
      case 'week':
        dateFrom = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        dateTo = format(now, 'yyyy-MM-dd')
        break
      case 'month':
        dateFrom = format(startOfMonth(now), 'yyyy-MM-dd')
        dateTo = format(endOfMonth(now), 'yyyy-MM-dd')
        break
      case 'year':
      default:
        dateFrom = `${goal.year}-01-01`
        dateTo = `${goal.year}-12-31`
        break
    }

    // Fetch all activities in period
    const { data: activities, error: actError } = await supabase
      .from('temp_goal_activity_log')
      .select('activity_type, origin_type, direction, quantity')
      .eq('consultant_id', goal.consultant_id)
      .gte('activity_date', dateFrom)
      .lte('activity_date', dateTo)

    if (actError) {
      return NextResponse.json({ error: 'Erro ao carregar actividades' }, { status: 500 })
    }

    // Aggregate by activity_type
    const breakdown: Record<string, {
      total: number
      system: number
      declared: number
      outbound: number
      inbound: number
    }> = {}

    for (const act of activities || []) {
      const type = act.activity_type
      if (!breakdown[type]) {
        breakdown[type] = { total: 0, system: 0, declared: 0, outbound: 0, inbound: 0 }
      }
      const qty = act.quantity || 1
      breakdown[type].total += qty
      if (act.origin_type === 'declared') {
        breakdown[type].declared += qty
      } else {
        breakdown[type].system += qty
      }
      if (act.direction === 'outbound') breakdown[type].outbound += qty
      if (act.direction === 'inbound') breakdown[type].inbound += qty
    }

    // Trust ratio (rolling 30 days)
    const thirtyDaysAgo = format(subDays(now, 30), 'yyyy-MM-dd')
    const { data: recentActivities } = await supabase
      .from('temp_goal_activity_log')
      .select('origin_type, quantity')
      .eq('consultant_id', goal.consultant_id)
      .gte('activity_date', thirtyDaysAgo)

    let totalRecent = 0
    let systemRecent = 0
    for (const act of recentActivities || []) {
      const qty = act.quantity || 1
      totalRecent += qty
      if (act.origin_type !== 'declared') systemRecent += qty
    }
    const trustRatio = totalRecent > 0 ? Math.round((systemRecent / totalRecent) * 100) / 100 : 1

    // Streak: consecutive weeks hitting >= 80% of weekly call target
    const weeklyCallTarget = goal.sellers_avg_calls_per_lead
      ? Math.round(Number(goal.sellers_avg_calls_per_lead) * 4.33)
      : null

    let streakWeeks = 0
    if (weeklyCallTarget && weeklyCallTarget > 0) {
      // Check up to 52 weeks back
      for (let w = 0; w < 52; w++) {
        const weekStart = format(startOfWeek(subWeeks(now, w), { weekStartsOn: 1 }), 'yyyy-MM-dd')
        const weekEnd = format(
          new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000),
          'yyyy-MM-dd'
        )

        const { data: weekActs } = await supabase
          .from('temp_goal_activity_log')
          .select('quantity')
          .eq('consultant_id', goal.consultant_id)
          .eq('activity_type', 'call')
          .gte('activity_date', weekStart)
          .lte('activity_date', weekEnd)

        const weekTotal = (weekActs || []).reduce((sum, a) => sum + (a.quantity || 1), 0)
        if (weekTotal >= weeklyCallTarget * 0.8) {
          streakWeeks++
        } else {
          break
        }
      }
    }

    return NextResponse.json({
      goal_id: id,
      consultant_id: goal.consultant_id,
      period,
      date_from: dateFrom,
      date_to: dateTo,
      activities: breakdown,
      trust_ratio: trustRatio,
      streak_weeks: streakWeeks,
    })
  } catch (error) {
    console.error('Goal summary error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
