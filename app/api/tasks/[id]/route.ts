import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { isLeadership } from '@/lib/auth/roles'
import { isTaskListMember } from '@/lib/tasks/access'
import { updateTaskSchema } from '@/lib/validations/task'
import { getNextOccurrence } from '@/lib/tasks/recurrence'
import { notificationService } from '@/lib/notifications/service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = createAdminClient()

    const { data: task, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignee:assigned_to(id, commercial_name),
        creator:created_by(id, commercial_name),
        completer:completed_by(id, commercial_name),
        sub_tasks:tasks!parent_task_id(
          id, title, is_completed, priority, due_date, assigned_to, order_index, completed_at,
          assignee:assigned_to(id, commercial_name)
        ),
        task_comments(count),
        task_attachments(count)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Gate: utilizadores não-leadership só podem ver tarefas onde são
    // assignee, criador, ou membro da lista a que a tarefa pertence.
    // Leadership passa o gate (drill-in para outro consultor) — mas se a
    // tarefa for `is_private` e o caller não é o dono, devolvemos uma
    // versão redacted ("Tarefa pessoal") sem título/descrição.
    const callerIsLeadership = isLeadership(auth.roles)
    const callerIsOwner =
      task.assigned_to === auth.user.id || task.created_by === auth.user.id

    if (!callerIsLeadership) {
      let allowed = callerIsOwner
      if (!allowed && task.task_list_id) {
        allowed = await isTaskListMember(supabase, task.task_list_id, auth.user.id)
      }
      if (!allowed) {
        return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
      }
    }

    if (callerIsLeadership && !callerIsOwner && task.is_private) {
      return NextResponse.json({
        id: task.id,
        title: 'Tarefa pessoal',
        description: null,
        assigned_to: task.assigned_to,
        created_by: task.created_by,
        priority: 4,
        due_date: task.due_date,
        is_recurring: false,
        recurrence_rule: null,
        is_completed: !!task.is_completed,
        completed_at: task.completed_at ?? null,
        completed_by: null,
        entity_type: null,
        entity_id: null,
        is_private: true,
        is_redacted: true,
        sub_tasks: [],
        reminders: [],
      })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Erro ao obter tarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const validation = updateTaskSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data
    const supabase = createAdminClient()

    // Fetch current task for recurring logic and notifications.
    // Inclui campos que o spawn precisa de preservar (description,
    // priority, task_list_id, section, entity_type/id, is_private) —
    // antes ficavam a NULL no spawn por omissão.
    const { data: currentTask } = await supabase
      .from('tasks')
      .select(
        'id, title, description, priority, is_completed, is_recurring, recurrence_rule, due_date, assigned_to, created_by, task_list_id, section, entity_type, entity_id, is_private',
      )
      .eq('id', id)
      .single()

    if (!currentTask) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // Gate: apenas leadership pode reatribuir tarefas a outros utilizadores;
    // consultor só pode reatribuir para si próprio, EXCEPTO dentro duma
    // lista partilhada onde tanto ele como o destinatário são membros.
    if (
      !isLeadership(auth.roles) &&
      data.assigned_to !== undefined &&
      data.assigned_to !== null &&
      data.assigned_to !== auth.user.id
    ) {
      let allowed = false
      const listId = (data as any).task_list_id ?? currentTask.task_list_id
      if (listId) {
        const [callerIsMember, targetIsMember] = await Promise.all([
          isTaskListMember(supabase, listId, auth.user.id),
          isTaskListMember(supabase, listId, data.assigned_to),
        ])
        allowed = callerIsMember && targetIsMember
      }
      if (!allowed) {
        return NextResponse.json(
          { error: 'Sem permissão para atribuir esta tarefa a outro utilizador.' },
          { status: 403 },
        )
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = { ...data }

    // Handle completion
    if (data.is_completed === true && !currentTask.is_completed) {
      updateData.completed_at = new Date().toISOString()
      updateData.completed_by = auth.user.id
    } else if (data.is_completed === false) {
      updateData.completed_at = null
      updateData.completed_by = null
    }

    const { data: updated, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select('id, title, is_completed, assigned_to, created_by')
      .single()

    if (error) {
      console.error('Erro ao actualizar tarefa:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Handle recurring: spawn next occurrence when completed.
    //
    // Skipped quando:
    //  - O caller passa `is_recurring: false` no mesmo PUT (Todoist-style
    //    "concluir e parar de repetir" — desliga a recorrência neste
    //    último UPDATE para que nenhum spawn dispare).
    //  - Já existe uma instância pendente futura com o mesmo título +
    //    rule + assignee — evita acumular cadeias paralelas (caso
    //    "Pagar outdoor" onde o utilizador criou recorrências
    //    duplicadas e cada conclusão gerava ainda mais spawns).
    if (
      data.is_completed === true &&
      !currentTask.is_completed &&
      currentTask.is_recurring &&
      data.is_recurring !== false &&
      currentTask.recurrence_rule &&
      currentTask.due_date
    ) {
      const nextDue = getNextOccurrence(currentTask.due_date, currentTask.recurrence_rule)
      if (nextDue) {
        const nowIso = new Date().toISOString()
        const dedupQuery = supabase
          .from('tasks')
          .select('id')
          .eq('title', currentTask.title)
          .eq('is_recurring', true)
          .eq('recurrence_rule', currentTask.recurrence_rule)
          .eq('is_completed', false)
          .gt('due_date', nowIso)
          .limit(1)
        // Scope por assignee — null e "" tratam-se de igual modo.
        if (currentTask.assigned_to) {
          dedupQuery.eq('assigned_to', currentTask.assigned_to)
        } else {
          dedupQuery.is('assigned_to', null)
        }
        const { data: existingFuture } = await dedupQuery.maybeSingle()

        if (!existingFuture) {
          await supabase.from('tasks').insert({
            title: currentTask.title,
            description: (currentTask as any).description ?? null,
            assigned_to: currentTask.assigned_to,
            created_by: currentTask.created_by,
            priority: (currentTask as any).priority ?? data.priority ?? 4,
            due_date: nextDue,
            is_recurring: true,
            recurrence_rule: currentTask.recurrence_rule,
            task_list_id: (currentTask as any).task_list_id ?? null,
            section: (currentTask as any).section ?? null,
            entity_type: (currentTask as any).entity_type ?? null,
            entity_id: (currentTask as any).entity_id ?? null,
            is_private: (currentTask as any).is_private ?? false,
          })
        }
      }
    }

    // Notify: task completed (notify creator if completer is different)
    if (data.is_completed === true && !currentTask.is_completed) {
      const notifyId = currentTask.created_by !== auth.user.id
        ? currentTask.created_by
        : currentTask.assigned_to !== auth.user.id
          ? currentTask.assigned_to
          : null

      if (notifyId) {
        await notificationService.create({
          recipientId: notifyId,
          senderId: auth.user.id,
          notificationType: 'task_completed',
          entityType: 'proc_task',
          entityId: id,
          title: 'Tarefa concluída',
          body: currentTask.title,
          actionUrl: `/dashboard/tarefas?task=${id}`,
        })
      }
    }

    // Notify: reassignment
    if (data.assigned_to && data.assigned_to !== currentTask.assigned_to && data.assigned_to !== auth.user.id) {
      await notificationService.create({
        recipientId: data.assigned_to,
        senderId: auth.user.id,
        notificationType: 'task_assigned',
        entityType: 'proc_task',
        entityId: id,
        title: 'Tarefa atribuída',
        body: currentTask.title,
        actionUrl: `/dashboard/tarefas?task=${id}`,
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao actualizar tarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erro ao eliminar tarefa:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar tarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
