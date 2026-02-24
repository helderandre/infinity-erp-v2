import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { commentSchema } from '@/lib/validations/comment'

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

    // Verificar autenticação
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar comentários com dados do utilizador
    const { data, error } = await (db.from('proc_task_comments') as ReturnType<typeof supabase.from>)
      .select('*, user:dev_users(id, commercial_name)')
      .eq('proc_task_id', taskId)
      .order('created_at', { ascending: true })

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
    const { id, taskId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    // Verificar autenticação
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validar body
    const body = await request.json()
    const validation = commentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Verificar que a tarefa pertence ao processo
    const { data: task, error: taskError } = await supabase
      .from('proc_tasks')
      .select('id')
      .eq('id', taskId)
      .eq('proc_instance_id', id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // Inserir comentário
    const { data: comment, error: insertError } = await (db.from('proc_task_comments') as ReturnType<typeof supabase.from>)
      .insert({
        proc_task_id: taskId,
        user_id: user.id,
        content: validation.data.content,
        mentions: validation.data.mentions,
      })
      .select('*, user:dev_users(id, commercial_name)')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json(comment, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
