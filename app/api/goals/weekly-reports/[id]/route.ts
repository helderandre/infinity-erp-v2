// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { managerFeedbackSchema } from '@/lib/validations/goal'

/**
 * GET /api/goals/weekly-reports/[id]
 * Get a single report with activity data for the week
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data: report, error } = await supabase
      .from('weekly_reports')
      .select(`
        *,
        consultant:dev_users!weekly_reports_consultant_id_fkey(
          id, commercial_name
        )
      `)
      .eq('id', id)
      .single()

    if (error || !report) {
      return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
    }

    // Get activities for this week
    const weekStart = report.week_start
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    const { data: activities } = await supabase
      .from('temp_goal_activity_log')
      .select('activity_type, origin_type, quantity')
      .eq('consultant_id', report.consultant_id)
      .gte('activity_date', weekStart)
      .lte('activity_date', weekEndStr)

    const acts = activities || []
    const systemCount = acts.filter(a => a.origin_type === 'system').reduce((s, a) => s + (a.quantity || 1), 0)
    const declaredCount = acts.filter(a => a.origin_type === 'declared').reduce((s, a) => s + (a.quantity || 1), 0)
    const totalCount = systemCount + declaredCount

    // Aggregate by type
    const byType: Record<string, { done: number }> = {}
    for (const a of acts) {
      if (!byType[a.activity_type]) byType[a.activity_type] = { done: 0 }
      byType[a.activity_type].done += a.quantity || 1
    }

    return NextResponse.json({
      ...report,
      activities: {
        total: totalCount,
        system: systemCount,
        declared: declaredCount,
        by_type: byType,
      },
      trust_ratio: totalCount > 0 ? systemCount / totalCount : 1,
    })
  } catch (error) {
    console.error('Erro ao obter relatório semanal:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * PUT /api/goals/weekly-reports/[id]
 * Update report — consultant saves draft/submits, or manager adds feedback
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()

    // Check report exists
    const { data: existing, error: fetchErr } = await supabase
      .from('weekly_reports')
      .select('id, consultant_id, status')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
    }

    const isOwner = existing.consultant_id === auth.user.id
    const isManagerAction = body.manager_feedback !== undefined

    if (isManagerAction) {
      // Manager reviewing
      const validation = managerFeedbackSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Dados inválidos', details: validation.error.flatten() },
          { status: 400 }
        )
      }

      const { data, error } = await supabase
        .from('weekly_reports')
        .update({
          manager_feedback: validation.data.manager_feedback,
          manager_reviewed_at: new Date().toISOString(),
          manager_reviewed_by: auth.user.id,
          status: 'reviewed',
        })
        .eq('id', id)
        .select('id, status')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    if (!isOwner) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Consultant updating their own report
    const updateData: Record<string, unknown> = {}
    if (body.notes_wins !== undefined) updateData.notes_wins = body.notes_wins
    if (body.notes_challenges !== undefined) updateData.notes_challenges = body.notes_challenges
    if (body.notes_next_week !== undefined) updateData.notes_next_week = body.notes_next_week

    if (body.submit) {
      updateData.status = 'submitted'
      updateData.submitted_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('weekly_reports')
      .update(updateData)
      .eq('id', id)
      .select('id, status')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar relatório semanal:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
