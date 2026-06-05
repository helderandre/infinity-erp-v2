// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createGoalActivitySchema } from '@/lib/validations/goal'

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

    // First get the goal to find the consultant_id
    const { data: goal, error: goalError } = await supabase
      .from('temp_consultant_goals')
      .select('consultant_id, year')
      .eq('id', id)
      .single()

    if (goalError || !goal) {
      return NextResponse.json({ error: 'Objetivo não encontrado' }, { status: 404 })
    }

    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const activityType = searchParams.get('activity_type')
    const origin = searchParams.get('origin')

    let query = supabase
      .from('temp_goal_activity_log')
      .select('*')
      .eq('consultant_id', goal.consultant_id)
      .order('activity_date', { ascending: false })
      .order('created_at', { ascending: false })

    // Default: filter by the goal's year
    if (dateFrom) {
      query = query.gte('activity_date', dateFrom)
    } else {
      query = query.gte('activity_date', `${goal.year}-01-01`)
    }
    if (dateTo) {
      query = query.lte('activity_date', dateTo)
    } else {
      query = query.lte('activity_date', `${goal.year}-12-31`)
    }
    if (activityType) query = query.eq('activity_type', activityType)
    if (origin) query = query.eq('origin', origin)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Erro ao listar actividades:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    // Get consultant_id from goal
    const { data: goal, error: goalError } = await supabase
      .from('temp_consultant_goals')
      .select('consultant_id')
      .eq('id', id)
      .single()

    if (goalError || !goal) {
      return NextResponse.json({ error: 'Objetivo não encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const validation = createGoalActivitySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data: activity, error } = await supabase
      .from('temp_goal_activity_log')
      .insert({
        consultant_id: goal.consultant_id,
        ...validation.data,
        created_by: auth.user.id,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: activity.id }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar actividade:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
