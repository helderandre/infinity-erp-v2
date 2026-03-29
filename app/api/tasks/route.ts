import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createTaskSchema, taskQuerySchema } from '@/lib/validations/task'
import { notificationService } from '@/lib/notifications/service'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const params = taskQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!params.success) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const {
      assigned_to, created_by, priority, is_completed, overdue,
      entity_type, entity_id, parent_task_id, search,
      limit, offset,
    } = params.data

    const supabase = createAdminClient()

    let query = supabase
      .from('tasks')
      .select(`
        *,
        assignee:assigned_to(id, commercial_name),
        creator:created_by(id, commercial_name),
        sub_tasks:tasks!parent_task_id(id, title, is_completed, priority, due_date, assigned_to, order_index)
      `, { count: 'exact' })
      .is('parent_task_id', null) // Top-level tasks only by default
      .order('is_completed', { ascending: true })
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1)

    // If requesting sub-tasks of a specific parent
    if (parent_task_id) {
      query = supabase
        .from('tasks')
        .select(`
          *,
          assignee:assigned_to(id, commercial_name),
          creator:created_by(id, commercial_name)
        `, { count: 'exact' })
        .eq('parent_task_id', parent_task_id)
        .order('order_index', { ascending: true })
        .range(offset, offset + limit - 1)
    }

    if (assigned_to) query = query.eq('assigned_to', assigned_to)
    if (created_by) query = query.eq('created_by', created_by)
    if (priority) query = query.eq('priority', priority)
    if (is_completed === 'true') query = query.eq('is_completed', true)
    if (is_completed === 'false') query = query.eq('is_completed', false)
    if (overdue === 'true') {
      query = query.eq('is_completed', false).lt('due_date', new Date().toISOString())
    }
    if (entity_type) query = query.eq('entity_type', entity_type)
    if (entity_id) query = query.eq('entity_id', entity_id)
    if (search) query = query.ilike('title', `%${search}%`)

    const { data, error, count } = await query

    if (error) {
      console.error('Erro ao listar tarefas:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar tarefas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const validation = createTaskSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data
    const supabase = createAdminClient()

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title: data.title,
        description: data.description || null,
        parent_task_id: data.parent_task_id || null,
        assigned_to: data.assigned_to || null,
        created_by: auth.user.id,
        priority: data.priority,
        due_date: data.due_date || null,
        is_recurring: data.is_recurring,
        recurrence_rule: data.recurrence_rule || null,
        entity_type: data.entity_type || null,
        entity_id: data.entity_id || null,
      })
      .select('id, title, assigned_to')
      .single()

    if (error) {
      console.error('Erro ao criar tarefa:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notify assignee if different from creator
    if (task.assigned_to && task.assigned_to !== auth.user.id) {
      await notificationService.create({
        recipientId: task.assigned_to,
        senderId: auth.user.id,
        notificationType: 'task_assigned',
        entityType: 'proc_task', // Reuse existing entity type
        entityId: task.id,
        title: 'Nova tarefa atribuída',
        body: task.title,
        actionUrl: `/dashboard/tarefas?task=${task.id}`,
      })
    }

    return NextResponse.json({ id: task.id }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar tarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
