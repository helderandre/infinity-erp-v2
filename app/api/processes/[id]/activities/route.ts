import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Get all task IDs for this process
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }

    const { data: tasks, error: tasksError } = await (db.from('proc_tasks') as ReturnType<typeof supabase.from>)
      .select('id, title, stage_name')
      .eq('proc_instance_id', processId)

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json([])
    }

    interface TaskRow { id: string; title: string; stage_name: string }
    const taskIds = (tasks as TaskRow[]).map((t) => t.id)
    const taskMap = new Map((tasks as TaskRow[]).map((t) => [t.id, { title: t.title, stage_name: t.stage_name }]))

    // Fetch all activities for all tasks in the process
    const { data: activities, error: activitiesError } = await (db.from('proc_task_activities') as ReturnType<typeof supabase.from>)
      .select('*, user:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url))')
      .in('proc_task_id', taskIds)
      .order('created_at', { ascending: false })
      .limit(200)

    if (activitiesError) {
      return NextResponse.json({ error: activitiesError.message }, { status: 500 })
    }

    // Enrich activities with task info
    const enriched = (activities || []).map((activity: { proc_task_id: string }) => {
      const taskInfo = taskMap.get(activity.proc_task_id)
      return {
        ...activity,
        task_title: taskInfo?.title || 'Tarefa desconhecida',
        stage_name: taskInfo?.stage_name || '',
      }
    })

    return NextResponse.json(enriched)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
