// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { startOfWeek, subWeeks, format } from 'date-fns'

const DECLARABLE_TYPES = ['call', 'visit', 'follow_up', 'lead_contact']

const PERIOD_MAP: Record<string, () => string> = {
  today: () => format(new Date(), 'yyyy-MM-dd'),
  yesterday: () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return format(d, 'yyyy-MM-dd')
  },
  this_week: () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  last_week: () => format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id: goalId } = await params
    const body = await request.json()
    const { activity_type, quantity, period, custom_date, direction, origin, notes } = body

    // Validate
    if (!activity_type || !DECLARABLE_TYPES.includes(activity_type)) {
      return NextResponse.json({ error: 'Tipo de actividade inválido' }, { status: 400 })
    }
    if (!quantity || quantity < 1 || quantity > 100) {
      return NextResponse.json({ error: 'Quantidade inválida (1-100)' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get the goal to find consultant_id
    const { data: goal, error: goalError } = await admin
      .from('temp_consultant_goals')
      .select('consultant_id')
      .eq('id', goalId)
      .single()

    if (goalError || !goal) {
      return NextResponse.json({ error: 'Objectivo não encontrado' }, { status: 404 })
    }

    // Determine activity_date
    let activityDate: string
    if (period === 'custom' && custom_date) {
      activityDate = custom_date
    } else if (period && PERIOD_MAP[period]) {
      activityDate = PERIOD_MAP[period]()
    } else {
      activityDate = format(new Date(), 'yyyy-MM-dd')
    }

    // Insert declared activity
    const { error: insertError } = await admin
      .from('temp_goal_activity_log')
      .insert({
        consultant_id: goal.consultant_id,
        activity_date: activityDate,
        activity_type,
        origin: origin || 'sellers',
        origin_type: 'declared',
        direction: direction || null,
        quantity: Math.round(quantity),
        notes: notes || null,
        created_by: user.id,
      })

    if (insertError) {
      console.error('Error declaring activities:', insertError)
      return NextResponse.json({ error: 'Erro ao registar actividades' }, { status: 500 })
    }

    return NextResponse.json({ success: true, quantity, activity_type })
  } catch (error) {
    console.error('Declare activities error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
