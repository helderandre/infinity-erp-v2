import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logTaskActivity } from '@/lib/processes/activity-logger'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data, error } = await (db.from('proc_task_activities') as ReturnType<typeof supabase.from>)
      .select('*, user:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url))')
      .eq('proc_task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { activity_type } = body

    // Apenas permitir "viewed" via POST directo
    if (activity_type !== 'viewed') {
      return NextResponse.json({ error: 'Tipo de actividade não permitido' }, { status: 400 })
    }

    // Verificar se já visualizou nos últimos 5 minutos (evitar spam)
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: recent } = await (db.from('proc_task_activities') as ReturnType<typeof supabase.from>)
      .select('id')
      .eq('proc_task_id', taskId)
      .eq('user_id', user.id)
      .eq('activity_type', 'viewed')
      .gte('created_at', fiveMinAgo)
      .limit(1)

    if (recent && recent.length > 0) {
      return NextResponse.json({ success: true, skipped: true })
    }

    const { data: currentUser } = await supabase
      .from('dev_users')
      .select('commercial_name')
      .eq('id', user.id)
      .single()
    const userName = currentUser?.commercial_name || 'Utilizador'

    await logTaskActivity(supabase, taskId, user.id, 'viewed', `${userName} visualizou a tarefa`)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
