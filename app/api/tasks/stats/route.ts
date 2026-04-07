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
    const todayStart = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'

    // Reusable filter for active/non-deleted process instances
    const ACTIVE_PROC = ['active', 'on_hold']

    // Run counts in parallel — across `tasks`, `proc_tasks` and `proc_subtasks`
    const [
      // tasks (general)
      tPendingRes, tOverdueRes, tCompletedTodayRes, tUrgentRes, tUpcomingRes,
      // proc_tasks
      ptPendingRes, ptOverdueRes, ptCompletedTodayRes, ptUrgentRes, ptUpcomingRes,
      // proc_subtasks
      psPendingRes, psOverdueRes, psCompletedTodayRes, psUrgentRes, psUpcomingRes,
    ] = await Promise.all([
      // ─── tasks ───
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('assigned_to', userId).eq('is_completed', false).is('parent_task_id', null),
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('assigned_to', userId).eq('is_completed', false).lt('due_date', now).is('parent_task_id', null),
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('completed_by', userId).eq('is_completed', true).gte('completed_at', todayStart).is('parent_task_id', null),
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('assigned_to', userId).eq('is_completed', false).eq('priority', 1).is('parent_task_id', null),
      supabase.from('tasks').select(`
          id, title, priority, due_date, entity_type, entity_id,
          assignee:assigned_to(id, commercial_name)
        `)
        .eq('assigned_to', userId).eq('is_completed', false).is('parent_task_id', null)
        .not('due_date', 'is', null).order('due_date', { ascending: true }).limit(5),

      // ─── proc_tasks ───
      supabase.from('proc_tasks').select('id, proc_instances!inner(current_status, deleted_at)', { count: 'exact', head: true })
        .eq('assigned_to', userId).not('status', 'in', '("completed","skipped")')
        .is('proc_instances.deleted_at', null).in('proc_instances.current_status', ACTIVE_PROC),
      supabase.from('proc_tasks').select('id, proc_instances!inner(current_status, deleted_at)', { count: 'exact', head: true })
        .eq('assigned_to', userId).not('status', 'in', '("completed","skipped")')
        .not('due_date', 'is', null).lt('due_date', now)
        .is('proc_instances.deleted_at', null).in('proc_instances.current_status', ACTIVE_PROC),
      supabase.from('proc_tasks').select('id, proc_instances!inner(current_status, deleted_at)', { count: 'exact', head: true })
        .eq('assigned_to', userId).eq('status', 'completed').gte('completed_at', todayStart)
        .is('proc_instances.deleted_at', null).in('proc_instances.current_status', ACTIVE_PROC),
      supabase.from('proc_tasks').select('id, proc_instances!inner(current_status, deleted_at)', { count: 'exact', head: true })
        .eq('assigned_to', userId).eq('priority', 'urgent').not('status', 'in', '("completed","skipped")')
        .is('proc_instances.deleted_at', null).in('proc_instances.current_status', ACTIVE_PROC),
      supabase.from('proc_tasks').select(`
          id, title, priority, due_date, proc_instance_id,
          proc_instances!inner(id, external_ref, current_status, deleted_at),
          assignee:dev_users!proc_tasks_assigned_to_fkey(id, commercial_name)
        `)
        .eq('assigned_to', userId).not('status', 'in', '("completed","skipped")')
        .not('due_date', 'is', null)
        .is('proc_instances.deleted_at', null).in('proc_instances.current_status', ACTIVE_PROC)
        .order('due_date', { ascending: true }).limit(5),

      // ─── proc_subtasks ───
      supabase.from('proc_subtasks').select('id, proc_tasks!inner(proc_instances!inner(current_status, deleted_at))', { count: 'exact', head: true })
        .eq('assigned_to', userId).eq('is_completed', false)
        .is('proc_tasks.proc_instances.deleted_at', null).in('proc_tasks.proc_instances.current_status', ACTIVE_PROC),
      supabase.from('proc_subtasks').select('id, proc_tasks!inner(proc_instances!inner(current_status, deleted_at))', { count: 'exact', head: true })
        .eq('assigned_to', userId).eq('is_completed', false)
        .not('due_date', 'is', null).lt('due_date', now)
        .is('proc_tasks.proc_instances.deleted_at', null).in('proc_tasks.proc_instances.current_status', ACTIVE_PROC),
      supabase.from('proc_subtasks').select('id, proc_tasks!inner(proc_instances!inner(current_status, deleted_at))', { count: 'exact', head: true })
        .eq('assigned_to', userId).eq('is_completed', true).gte('completed_at', todayStart)
        .is('proc_tasks.proc_instances.deleted_at', null).in('proc_tasks.proc_instances.current_status', ACTIVE_PROC),
      supabase.from('proc_subtasks').select('id, proc_tasks!inner(proc_instances!inner(current_status, deleted_at))', { count: 'exact', head: true })
        .eq('assigned_to', userId).eq('priority', 'urgent').eq('is_completed', false)
        .is('proc_tasks.proc_instances.deleted_at', null).in('proc_tasks.proc_instances.current_status', ACTIVE_PROC),
      supabase.from('proc_subtasks').select(`
          id, title, priority, due_date, proc_task_id,
          proc_tasks!inner(id, proc_instance_id, proc_instances!inner(id, external_ref, current_status, deleted_at)),
          assignee:dev_users!proc_subtasks_assigned_to_fkey(id, commercial_name)
        `)
        .eq('assigned_to', userId).eq('is_completed', false)
        .not('due_date', 'is', null)
        .is('proc_tasks.proc_instances.deleted_at', null).in('proc_tasks.proc_instances.current_status', ACTIVE_PROC)
        .order('due_date', { ascending: true }).limit(5),
    ])

    // Merge upcoming from all three sources, sorted by due_date, top 5
    const upcoming: any[] = [
      ...(tUpcomingRes.data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        due_date: t.due_date,
        entity_type: t.entity_type,
        entity_id: t.entity_id,
        assignee: t.assignee,
      })),
      ...(ptUpcomingRes.data || []).map((pt: any) => ({
        id: `proc_task:${pt.id}`,
        title: pt.title,
        priority: pt.priority === 'urgent' ? 1 : pt.priority === 'high' ? 2 : pt.priority === 'low' ? 4 : 3,
        due_date: pt.due_date,
        entity_type: 'process',
        entity_id: pt.proc_instance_id,
        assignee: pt.assignee,
      })),
      ...(psUpcomingRes.data || []).map((sub: any) => ({
        id: `proc_subtask:${sub.id}`,
        title: sub.title,
        priority: sub.priority === 'urgent' ? 1 : sub.priority === 'high' ? 2 : sub.priority === 'low' ? 4 : 3,
        due_date: sub.due_date,
        entity_type: 'process',
        entity_id: sub.proc_tasks?.proc_instance_id ?? null,
        assignee: sub.assignee,
      })),
    ]
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5)

    return NextResponse.json({
      pending: (tPendingRes.count || 0) + (ptPendingRes.count || 0) + (psPendingRes.count || 0),
      overdue: (tOverdueRes.count || 0) + (ptOverdueRes.count || 0) + (psOverdueRes.count || 0),
      completed_today: (tCompletedTodayRes.count || 0) + (ptCompletedTodayRes.count || 0) + (psCompletedTodayRes.count || 0),
      urgent: (tUrgentRes.count || 0) + (ptUrgentRes.count || 0) + (psUrgentRes.count || 0),
      upcoming,
    })
  } catch (error) {
    console.error('Erro ao obter stats de tarefas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
