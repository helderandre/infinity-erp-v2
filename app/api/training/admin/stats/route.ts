// @ts-nocheck
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const supabase = createAdminClient()

    // 1. Course completion stats (da view)
    const { data: courseStats } = await supabase
      .from('forma_course_completion_stats')
      .select('*')
      .order('total_enrolled', { ascending: false })

    // 2. Overview KPIs
    const { count: openReports } = await supabase
      .from('forma_training_lesson_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')

    const { count: unresolvedComments } = await supabase
      .from('forma_training_comments')
      .select('id', { count: 'exact', head: true })
      .eq('is_resolved', false)
      .is('parent_id', null)

    const { count: totalDownloads } = await supabase
      .from('forma_training_material_downloads')
      .select('id', { count: 'exact', head: true })

    // 3. Completion by month (últimos 6 meses)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: recentCompletions } = await supabase
      .from('forma_training_enrollments')
      .select('completed_at')
      .eq('status', 'completed')
      .gte('completed_at', sixMonthsAgo.toISOString())

    const completionByMonth = groupByMonth(recentCompletions || [])

    // 4. Avg completion rate
    const avgRate = courseStats?.length
      ? courseStats.reduce((sum: number, c: any) => sum + (c.completion_rate || 0), 0) / courseStats.length
      : 0

    return NextResponse.json({
      course_stats: courseStats || [],
      overview: {
        total_reports_open: openReports || 0,
        total_comments_unresolved: unresolvedComments || 0,
        avg_completion_rate: Math.round(avgRate * 10) / 10,
        total_downloads: totalDownloads || 0,
      },
      completion_by_month: completionByMonth,
    })
  } catch (error) {
    console.error('Erro ao carregar stats admin:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

function groupByMonth(completions: { completed_at: string }[]) {
  const months: Record<string, number> = {}
  for (const c of completions) {
    if (!c.completed_at) continue
    const month = c.completed_at.slice(0, 7) // YYYY-MM
    months[month] = (months[month] || 0) + 1
  }
  return Object.entries(months)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
