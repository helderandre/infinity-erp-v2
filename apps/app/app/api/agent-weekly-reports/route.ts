// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

// GET /api/agent-weekly-reports?week_start=YYYY-MM-DD[&agent_id=...]
// Returns the report for the given week (or null if not yet created).
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('week_start')
    const agentParam = searchParams.get('agent_id')

    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: 'week_start inválido (YYYY-MM-DD)' }, { status: 400 })
    }

    const canSeeAll = isManagementRole(auth.roles)
    const agent_id = canSeeAll && agentParam ? agentParam : auth.user.id

    const { data, error } = await supabase
      .from('agent_weekly_reports')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? null })
  } catch (error) {
    console.error('Erro ao obter weekly report:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT /api/agent-weekly-reports
// Upserts the report for (auth.user, week_start). Body: { week_start, notes_* }.
export async function PUT(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const body = await request.json()
    const weekStart = body?.week_start
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: 'week_start inválido' }, { status: 400 })
    }

    const payload = {
      agent_id: auth.user.id,
      week_start: weekStart,
      notes_wins: body.notes_wins ?? null,
      notes_challenges: body.notes_challenges ?? null,
      notes_next_week: body.notes_next_week ?? null,
    }

    const { data, error } = await supabase
      .from('agent_weekly_reports')
      .upsert(payload, { onConflict: 'agent_id,week_start' })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Erro ao gravar weekly report:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
