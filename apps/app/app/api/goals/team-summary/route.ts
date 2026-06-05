// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { calcRealityCheck } from '@/lib/goals/calculations'
import type { ConsultantGoal, GoalStatus } from '@/types/goal'

/**
 * GET /api/goals/team-summary?year=YYYY
 *
 * Aggregated team view for the manager Objetivos page.
 * One round-trip: returns per-consultant snapshot + team totals.
 */

export interface TeamSummaryRow {
  goal_id: string
  consultant_id: string
  commercial_name: string
  profile_photo_url: string | null
  annual_target: number
  realized: number
  pct_achieved: number
  pct_of_period_target: number
  projected_annual: number
  status: GoalStatus
  weekly_activities: number
  last_report_status: 'draft' | 'submitted' | 'reviewed' | null
  last_report_at: string | null
}

export interface TeamSummaryTotals {
  annual_target: number
  realized: number
  pct_achieved: number
  projected_annual: number
  consultants_count: number
  weekly_activities: number
  reports_submitted: number
  reports_reviewed: number
  reports_pending: number
}

export interface TeamSummaryResponse {
  year: number
  consultants: TeamSummaryRow[]
  totals: TeamSummaryTotals
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const year = Number(searchParams.get('year')) || new Date().getFullYear()

    // 1. Goals for this year
    const { data: goals, error: goalsError } = await supabase
      .from('temp_consultant_goals')
      .select(`
        *,
        consultant:dev_users!temp_consultant_goals_consultant_id_fkey(
          id, commercial_name,
          dev_consultant_profiles(profile_photo_url)
        )
      `)
      .eq('is_active', true)
      .eq('year', year)
      .order('annual_revenue_target', { ascending: false })

    if (goalsError) {
      return NextResponse.json({ error: goalsError.message }, { status: 500 })
    }

    if (!goals || goals.length === 0) {
      return NextResponse.json({
        year,
        consultants: [],
        totals: {
          annual_target: 0, realized: 0, pct_achieved: 0, projected_annual: 0,
          consultants_count: 0, weekly_activities: 0,
          reports_submitted: 0, reports_reviewed: 0, reports_pending: 0,
        },
      })
    }

    const consultantIds = goals.map(g => g.consultant_id)

    // 2. Year activities for all consultants in one query
    const { data: activities } = await supabase
      .from('temp_goal_activity_log')
      .select('consultant_id, activity_type, revenue_amount, activity_date')
      .in('consultant_id', consultantIds)
      .gte('activity_date', `${year}-01-01`)
      .lte('activity_date', `${year}-12-31`)

    const acts = activities || []

    // Index activities by consultant_id
    const actsByConsultant = new Map<string, typeof acts>()
    for (const a of acts) {
      const arr = actsByConsultant.get(a.consultant_id) || []
      arr.push(a)
      actsByConsultant.set(a.consultant_id, arr)
    }

    // Compute current week range
    const now = new Date()
    const dow = now.getDay()
    const monOff = dow === 0 ? -6 : 1 - dow
    const monday = new Date(now); monday.setDate(now.getDate() + monOff)
    const mondayStr = monday.toISOString().split('T')[0]
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const sundayStr = sunday.toISOString().split('T')[0]

    // 3. Latest weekly report for each consultant for current week
    const { data: latestReports } = await supabase
      .from('weekly_reports')
      .select('consultant_id, status, submitted_at, reviewed_at, week_start')
      .in('consultant_id', consultantIds)
      .eq('week_start', mondayStr)

    const reportsByConsultant = new Map<string, { status: 'draft' | 'submitted' | 'reviewed'; at: string | null }>()
    for (const r of latestReports || []) {
      reportsByConsultant.set(r.consultant_id, {
        status: r.status as 'draft' | 'submitted' | 'reviewed',
        at: r.reviewed_at || r.submitted_at || null,
      })
    }

    // 4. Compute per-consultant rows
    const consultants: TeamSummaryRow[] = goals.map(goal => {
      const consActs = actsByConsultant.get(goal.consultant_id) || []
      const totalRealized = consActs
        .filter(a => a.revenue_amount && (a.activity_type === 'sale_close' || a.activity_type === 'buyer_close'))
        .reduce((sum, a) => sum + (a.revenue_amount || 0), 0)

      const reality = calcRealityCheck(goal as ConsultantGoal, totalRealized)
      const weekActs = consActs.filter(a => a.activity_date >= mondayStr && a.activity_date <= sundayStr)
      const report = reportsByConsultant.get(goal.consultant_id)

      // dev_consultant_profiles may be returned as object or single-element array depending on PostgREST shape
      const profileData = goal.consultant?.dev_consultant_profiles
      const profilePhoto = Array.isArray(profileData)
        ? profileData[0]?.profile_photo_url ?? null
        : profileData?.profile_photo_url ?? null

      return {
        goal_id: goal.id,
        consultant_id: goal.consultant_id,
        commercial_name: goal.consultant?.commercial_name || '—',
        profile_photo_url: profilePhoto,
        annual_target: goal.annual_revenue_target,
        realized: totalRealized,
        pct_achieved: goal.annual_revenue_target > 0
          ? Math.min((totalRealized / goal.annual_revenue_target) * 100, 999)
          : 0,
        pct_of_period_target: reality.pct_achieved,
        projected_annual: reality.projected_annual,
        status: reality.status,
        weekly_activities: weekActs.length,
        last_report_status: report?.status || null,
        last_report_at: report?.at || null,
      }
    })

    // 5. Totals
    const annualTarget = consultants.reduce((s, c) => s + c.annual_target, 0)
    const realized = consultants.reduce((s, c) => s + c.realized, 0)
    const projectedAnnual = consultants.reduce((s, c) => s + c.projected_annual, 0)
    const weeklyActivities = consultants.reduce((s, c) => s + c.weekly_activities, 0)
    const reportsSubmitted = consultants.filter(c => c.last_report_status === 'submitted' || c.last_report_status === 'reviewed').length
    const reportsReviewed = consultants.filter(c => c.last_report_status === 'reviewed').length
    const reportsPending = consultants.length - reportsSubmitted

    const totals: TeamSummaryTotals = {
      annual_target: annualTarget,
      realized,
      pct_achieved: annualTarget > 0 ? (realized / annualTarget) * 100 : 0,
      projected_annual: projectedAnnual,
      consultants_count: consultants.length,
      weekly_activities: weeklyActivities,
      reports_submitted: reportsSubmitted,
      reports_reviewed: reportsReviewed,
      reports_pending: reportsPending,
    }

    return NextResponse.json({ year, consultants, totals })
  } catch (error) {
    console.error('Erro ao calcular team summary:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
