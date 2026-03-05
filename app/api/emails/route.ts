import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('task_id')
    const subtaskId = searchParams.get('subtask_id')

    if (!taskId) {
      return NextResponse.json({ error: 'task_id é obrigatório' }, { status: 400 })
    }

    const adminDb = createAdminClient()
    let query = adminDb
      .from('log_emails')
      .select('*')
      .eq('proc_task_id', taskId)
      .order('sent_at', { ascending: false })

    if (subtaskId) {
      query = query.eq('proc_subtask_id', subtaskId)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
