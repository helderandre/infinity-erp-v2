import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id') || auth.user.id

    const supabase = createAdminClient()
    const now = new Date().toISOString()

    // Run counts in parallel
    const [pendingRes, overdueRes, completedTodayRes, urgentRes, upcomingRes] = await Promise.all([
      // Pending (not completed)
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .eq('is_completed', false)
        .is('parent_task_id', null),

      // Overdue
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .eq('is_completed', false)
        .lt('due_date', now)
        .is('parent_task_id', null),

      // Completed today
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('completed_by', userId)
        .eq('is_completed', true)
        .gte('completed_at', new Date().toISOString().split('T')[0] + 'T00:00:00.000Z')
        .is('parent_task_id', null),

      // Urgent (P1) pending
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .eq('is_completed', false)
        .eq('priority', 1)
        .is('parent_task_id', null),

      // Upcoming (due in next 7 days, top 5)
      supabase
        .from('tasks')
        .select(`
          id, title, priority, due_date, entity_type, entity_id,
          assignee:assigned_to(id, commercial_name)
        `)
        .eq('assigned_to', userId)
        .eq('is_completed', false)
        .is('parent_task_id', null)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
        .limit(5),
    ])

    return NextResponse.json({
      pending: pendingRes.count || 0,
      overdue: overdueRes.count || 0,
      completed_today: completedTodayRes.count || 0,
      urgent: urgentRes.count || 0,
      upcoming: upcomingRes.data || [],
    })
  } catch (error) {
    console.error('Erro ao obter stats de tarefas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
