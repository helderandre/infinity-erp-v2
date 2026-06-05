// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { submitWeeklyReportSchema } from '@/lib/validations/goal'

/**
 * GET /api/goals/weekly-reports
 * List weekly reports. Filters: consultant_id, week_start, status
 */
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const consultantId = searchParams.get('consultant_id')
    const weekStart = searchParams.get('week_start')
    const status = searchParams.get('status')

    const supabase = await createClient()

    let query = supabase
      .from('weekly_reports')
      .select(`
        *,
        consultant:dev_users!weekly_reports_consultant_id_fkey(
          id, commercial_name
        )
      `)
      .order('week_start', { ascending: false })

    if (consultantId) query = query.eq('consultant_id', consultantId)
    if (weekStart) query = query.eq('week_start', weekStart)
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Erro ao listar relatórios semanais:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * POST /api/goals/weekly-reports
 * Create or update (upsert) a weekly report for the current user.
 * Body: { week_start, goal_id?, notes_wins?, notes_challenges?, notes_next_week?, submit? }
 */
export async function POST(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const { week_start, goal_id, submit } = body

    if (!week_start || !/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
      return NextResponse.json({ error: 'week_start inválido (YYYY-MM-DD)' }, { status: 400 })
    }

    // Validate notes if provided
    const notesValidation = submitWeeklyReportSchema.safeParse(body)
    if (!notesValidation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: notesValidation.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const upsertData: Record<string, unknown> = {
      consultant_id: auth.user.id,
      week_start,
      notes_wins: notesValidation.data.notes_wins || null,
      notes_challenges: notesValidation.data.notes_challenges || null,
      notes_next_week: notesValidation.data.notes_next_week || null,
    }

    if (goal_id) upsertData.goal_id = goal_id
    if (submit) {
      upsertData.status = 'submitted'
      upsertData.submitted_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('weekly_reports')
      .upsert(upsertData, { onConflict: 'consultant_id,week_start' })
      .select('id, status')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar relatório semanal:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
