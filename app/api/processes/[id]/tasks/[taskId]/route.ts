import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { recalculateProgress } from '@/lib/process-engine'
import { z } from 'zod'
import { notificationService } from '@/lib/notifications/service'
import { logTaskActivity } from '@/lib/processes/activity-logger'
import { ADHOC_TASK_ROLES } from '@/lib/constants'

const taskUpdateSchema = z.object({
  action: z.enum(['complete', 'bypass', 'assign', 'start', 'reset', 'update_priority', 'update_due_date']),
  bypass_reason: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  task_result: z.record(z.string(), z.any()).optional(),
  priority: z.enum(['urgent', 'normal', 'low']).optional(),
  due_date: z.string().optional(),
  resend_email_id: z.string().optional(),
  email_metadata: z.object({
    sender_email: z.string().optional(),
    sender_name: z.string().optional(),
    recipient_email: z.string().optional(),
    cc: z.array(z.string()).optional(),
    subject: z.string().optional(),
    body_html: z.string().optional(),
  }).optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params
    const supabase = await createClient()

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Parse e validação
    const body = await request.json()
    const validation = taskUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { action, bypass_reason, assigned_to, task_result, priority, due_date, resend_email_id, email_metadata } = validation.data

    // Obter tarefa
    const { data: task, error: taskError } = await supabase
      .from('proc_tasks')
      .select('*, proc_instance:proc_instances(current_status, external_ref, requested_by)')
      .eq('id', taskId)
      .eq('proc_instance_id', id)
      .single()

    if (taskError || !task) {
      return NextResponse.json(
        { error: 'Tarefa não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se o processo está activo
    const procStatus = (task as any).proc_instance?.current_status
    if (!['active', 'on_hold'].includes(procStatus)) {
      return NextResponse.json(
        { error: 'Apenas processos activos podem ter tarefas actualizadas' },
        { status: 400 }
      )
    }

    // Executar acção
    let updateData: any = {}

    switch (action) {
      case 'start':
        if (task.status !== 'pending') {
          return NextResponse.json(
            { error: 'Apenas tarefas pendentes podem ser iniciadas' },
            { status: 400 }
          )
        }
        updateData.status = 'in_progress'
        updateData.started_at = new Date().toISOString()
        updateData.assigned_to = user.id
        break

      case 'complete':
        if (!task.status || !['pending', 'in_progress'].includes(task.status)) {
          return NextResponse.json(
            { error: 'Tarefa não pode ser concluída no estado actual' },
            { status: 400 }
          )
        }
        updateData.status = 'completed'
        updateData.completed_at = new Date().toISOString()
        if (task_result) {
          updateData.task_result = task_result
        }
        break

      case 'bypass':
        if (task.status === 'completed') {
          return NextResponse.json(
            { error: 'Tarefa já concluída não pode ser dispensada' },
            { status: 400 }
          )
        }
        if (!bypass_reason || bypass_reason.length < 10) {
          return NextResponse.json(
            { error: 'Motivo da dispensa é obrigatório (mín. 10 caracteres)' },
            { status: 400 }
          )
        }
        updateData.status = 'skipped'
        updateData.is_bypassed = true
        updateData.bypass_reason = bypass_reason
        updateData.bypassed_by = user.id
        updateData.completed_at = new Date().toISOString()
        break

      case 'assign':
        if (!assigned_to) {
          return NextResponse.json(
            { error: 'ID do utilizador é obrigatório para atribuir' },
            { status: 400 }
          )
        }
        updateData.assigned_to = assigned_to
        break

      case 'reset': {
        if (!['skipped', 'completed'].includes(task.status as string)) {
          return NextResponse.json(
            { error: 'Apenas tarefas concluídas ou dispensadas podem ser reactivadas' },
            { status: 400 }
          )
        }
        // Reverter tarefa completed requer role autorizado
        if (task.status === 'completed') {
          const { data: resetRole } = await supabase
            .from('user_roles')
            .select('role:roles(name)')
            .eq('user_id', user.id)
            .limit(1)
            .single()
          const resetRoleName = (resetRole?.role as any)?.name
          if (!resetRoleName || !ADHOC_TASK_ROLES.includes(resetRoleName as any)) {
            return NextResponse.json(
              { error: 'Sem permissão para reverter tarefas concluídas' },
              { status: 403 }
            )
          }
        }
        updateData.status = 'pending'
        updateData.is_bypassed = false
        updateData.bypass_reason = null
        updateData.bypassed_by = null
        updateData.completed_at = null
        break
      }

      case 'update_priority':
        if (!priority) {
          return NextResponse.json(
            { error: 'Prioridade é obrigatória' },
            { status: 400 }
          )
        }
        updateData.priority = priority
        break

      case 'update_due_date':
        updateData.due_date = due_date || null
        break

      default:
        return NextResponse.json(
          { error: 'Acção inválida' },
          { status: 400 }
        )
    }

    // Actualizar tarefa
    const { error: updateError } = await supabase
      .from('proc_tasks')
      .update(updateData)
      .eq('id', taskId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao actualizar tarefa', details: updateError.message },
        { status: 500 }
      )
    }

    // Inserir log_emails para EMAIL tasks com resend_email_id
    if (action === 'complete' && resend_email_id && (task as any).action_type === 'EMAIL') {
      const adminDb = createAdminClient() as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }
      const { error: logError } = await adminDb.from('log_emails').insert({
        proc_task_id: taskId,
        resend_email_id,
        recipient_email: email_metadata?.recipient_email || '',
        sender_email: email_metadata?.sender_email || null,
        sender_name: email_metadata?.sender_name || null,
        cc: email_metadata?.cc || null,
        subject: email_metadata?.subject || null,
        body_html: email_metadata?.body_html || null,
        sent_at: new Date().toISOString(),
        delivery_status: 'sent',
        last_event: 'sent',
        events: [{ type: 'sent', timestamp: new Date().toISOString() }],
      })
      if (logError) console.error('[log_emails] Erro ao inserir:', logError)
    }

    // Recalcular progresso do processo
    if (['complete', 'bypass', 'reset'].includes(action)) {
      const progressResult = await recalculateProgress(id)
      console.log('Progress recalculated:', progressResult)
    }

    // --- Registar actividade ---
    try {
      const { data: currentUser } = await supabase
        .from('dev_users')
        .select('commercial_name')
        .eq('id', user.id)
        .single()
      const userName = currentUser?.commercial_name || 'Utilizador'

      switch (action) {
        case 'start':
          await logTaskActivity(supabase, taskId, user.id, 'started', `${userName} iniciou a tarefa`)
          break
        case 'complete':
          await logTaskActivity(supabase, taskId, user.id, 'completed', `${userName} concluiu a tarefa`)
          break
        case 'bypass':
          await logTaskActivity(supabase, taskId, user.id, 'bypass', `${userName} dispensou a tarefa: ${bypass_reason}`, { reason: bypass_reason })
          break
        case 'assign': {
          const { data: assignedUser } = await supabase
            .from('dev_users')
            .select('commercial_name')
            .eq('id', assigned_to!)
            .single()
          await logTaskActivity(supabase, taskId, user.id, 'assignment', `${userName} atribuiu a tarefa a ${assignedUser?.commercial_name || 'utilizador'}`, {
            old_user_id: task.assigned_to,
            new_user_id: assigned_to,
            new_user_name: assignedUser?.commercial_name,
          })
          break
        }
        case 'update_priority':
          await logTaskActivity(supabase, taskId, user.id, 'priority_change', `${userName} alterou a prioridade de ${task.priority || 'normal'} para ${priority}`, {
            old_priority: task.priority || 'normal',
            new_priority: priority,
          })
          break
        case 'update_due_date':
          await logTaskActivity(supabase, taskId, user.id, 'due_date_change', `${userName} alterou a data limite`, {
            old_due_date: task.due_date,
            new_due_date: due_date,
          })
          break
        case 'reset':
          await logTaskActivity(supabase, taskId, user.id, 'status_change', `${userName} reactivou a tarefa`, {
            old_status: task.status,
            new_status: 'pending',
          })
          break
      }
    } catch (activityError) {
      console.error('[TaskUpdate] Erro ao registar actividade:', activityError)
    }

    // --- Notificações ---
    try {
      const procRef = (task as any).proc_instance?.external_ref || ''

      if (action === 'assign' && assigned_to && assigned_to !== user.id) {
        // #3: Tarefa atribuída
        await notificationService.create({
          recipientId: assigned_to,
          senderId: user.id,
          notificationType: 'task_assigned',
          entityType: 'proc_task',
          entityId: taskId,
          title: 'Tarefa atribuída',
          body: `A tarefa "${task.title}" foi-lhe atribuída no processo ${procRef}`,
          actionUrl: `/dashboard/processos/${id}?task=${taskId}`,
          metadata: { process_ref: procRef, task_title: task.title },
        })
      }

      if (action === 'complete') {
        // #4: Tarefa concluída — notificar Gestora Processual
        const gestoraIds = await notificationService.getUserIdsByRoles(['Gestora Processual'])
        if (gestoraIds.length > 0) {
          await notificationService.createBatch(gestoraIds, {
            senderId: user.id,
            notificationType: 'task_completed',
            entityType: 'proc_task',
            entityId: taskId,
            title: 'Tarefa concluída',
            body: `A tarefa "${task.title}" foi concluída no processo ${procRef}`,
            actionUrl: `/dashboard/processos/${id}?task=${taskId}`,
            metadata: { process_ref: procRef, task_title: task.title },
          })
        }
      }

      if ((action === 'update_priority' || action === 'update_due_date') && task.assigned_to && task.assigned_to !== user.id) {
        // #9: Tarefa actualizada
        const detail = action === 'update_priority'
          ? `prioridade alterada para ${priority}`
          : `data limite alterada`
        await notificationService.create({
          recipientId: task.assigned_to,
          senderId: user.id,
          notificationType: 'task_updated',
          entityType: 'proc_task',
          entityId: taskId,
          title: 'Tarefa actualizada',
          body: `A tarefa "${task.title}" foi actualizada: ${detail}`,
          actionUrl: `/dashboard/processos/${id}?task=${taskId}`,
          metadata: { process_ref: procRef, task_title: task.title, change: action },
        })
      }
    } catch (notifError) {
      console.error('[TaskUpdate] Erro ao enviar notificações:', notifError)
    }

    // --- Alertas configurados no template ---
    try {
      const taskConfig = ((task as any).config as Record<string, any>) || {}
      if (taskConfig.alerts) {
        const { alertService } = await import('@/lib/alerts/service')
        const procRef = (task as any).proc_instance?.external_ref || ''

        if (action === 'complete' && taskConfig.alerts.on_complete?.enabled) {
          await alertService.processAlert(taskConfig.alerts.on_complete, {
            procInstanceId: id,
            entityType: 'proc_task',
            entityId: taskId,
            eventType: 'on_complete',
            title: task.title,
            processRef: procRef,
            triggeredBy: user.id,
            assignedTo: task.assigned_to,
          })
        }

        if (action === 'assign' && assigned_to && taskConfig.alerts.on_assign?.enabled) {
          await alertService.processAlert(taskConfig.alerts.on_assign, {
            procInstanceId: id,
            entityType: 'proc_task',
            entityId: taskId,
            eventType: 'on_assign',
            title: task.title,
            processRef: procRef,
            triggeredBy: user.id,
            assignedTo: assigned_to,
          })
        }
      }
    } catch (alertError) {
      console.error('[TaskUpdate] Erro ao processar alertas:', alertError)
    }

    // --- Trigger on_unblock para tarefas dependentes ---
    if (action === 'complete') {
      try {
        const { data: dependentTasks } = await supabase
          .from('proc_tasks')
          .select('id, title, config, assigned_to')
          .eq('proc_instance_id', id)
          .eq('dependency_proc_task_id', taskId)
          .in('status', ['pending', 'blocked'])

        if (dependentTasks?.length) {
          const { alertService: als } = await import('@/lib/alerts/service')
          const procRefUnblock = (task as any).proc_instance?.external_ref || ''

          for (const depTask of dependentTasks) {
            const depConfig = (depTask.config as Record<string, any>)?.alerts?.on_unblock
            if (depConfig?.enabled) {
              await als.processAlert(depConfig, {
                procInstanceId: id,
                entityType: 'proc_task',
                entityId: depTask.id,
                eventType: 'on_unblock',
                title: depTask.title,
                processRef: procRefUnblock,
                triggeredBy: user.id,
                assignedTo: depTask.assigned_to,
              })
            }
          }
        }
      } catch (unblockError) {
        console.error('[TaskUpdate] Erro ao processar on_unblock:', unblockError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Tarefa actualizada com sucesso',
    })
  } catch (error) {
    console.error('Erro ao actualizar tarefa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// DELETE — Remover tarefa ad-hoc
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params
    const supabase = await createClient()
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }

    // 1. Autenticar
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 2. Verificar role autorizado
    const { data: devUser } = await supabase
      .from('dev_users')
      .select('id, commercial_name')
      .eq('id', user.id)
      .single()

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role:roles(name)')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    const roleName = (userRole?.role as any)?.name
    if (!roleName || !ADHOC_TASK_ROLES.includes(roleName as any)) {
      return NextResponse.json(
        { error: 'Sem permissão para remover tarefas' },
        { status: 403 }
      )
    }

    // 3. Obter tarefa
    const { data: task, error: taskError } = await supabase
      .from('proc_tasks')
      .select('id, title, tpl_task_id, stage_name, status, proc_instance_id')
      .eq('id', taskId)
      .eq('proc_instance_id', id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // 4. Verificar que é ad-hoc (tpl_task_id IS NULL)
    if (task.tpl_task_id !== null) {
      return NextResponse.json(
        { error: 'Apenas tarefas ad-hoc podem ser removidas. Tarefas de template podem ser dispensadas.' },
        { status: 403 }
      )
    }

    // 5. Validar processo activo
    const { data: process } = await supabase
      .from('proc_instances')
      .select('current_status')
      .eq('id', id)
      .single()

    if (!process || !['active', 'on_hold'].includes(process.current_status as string)) {
      return NextResponse.json(
        { error: 'Apenas processos activos ou pausados permitem remover tarefas' },
        { status: 400 }
      )
    }

    // 6. Verificar dependências
    const { data: dependentTasks } = await supabase
      .from('proc_tasks')
      .select('id, title')
      .eq('proc_instance_id', id)
      .eq('dependency_proc_task_id', taskId)

    if (dependentTasks && dependentTasks.length > 0) {
      return NextResponse.json(
        {
          error: 'Existem tarefas que dependem desta tarefa. Remova as dependências primeiro.',
          dependent_tasks: dependentTasks.map(t => t.title),
        },
        { status: 409 }
      )
    }

    // Verificar dependências de subtarefas de outras tarefas
    const { data: dependentSubtasks } = await adminDb.from('proc_subtasks')
      .select('id')
      .eq('dependency_proc_task_id', taskId)

    if (dependentSubtasks && (dependentSubtasks as any[]).length > 0) {
      return NextResponse.json(
        { error: 'Existem subtarefas que dependem desta tarefa. Remova as dependências primeiro.' },
        { status: 409 }
      )
    }

    // 7. Contar subtarefas antes de eliminar
    const { data: subtasks } = await adminDb.from('proc_subtasks')
      .select('id')
      .eq('proc_task_id', taskId)
    const subtaskCount = (subtasks as any[] | null)?.length || 0

    // 8. Registar actividade ANTES da eliminação
    try {
      const userName = devUser?.commercial_name || 'Utilizador'
      await logTaskActivity(
        supabase, taskId, user.id,
        'task_deleted',
        `${userName} removeu tarefa ad-hoc "${task.title}" da fase "${task.stage_name}"`,
        {
          is_adhoc: true,
          deleted_task_title: task.title,
          stage_name: task.stage_name,
          deleted_subtask_count: subtaskCount,
          task_status_at_deletion: task.status,
          deleted_by_role: roleName,
        }
      )
    } catch (activityError) {
      console.error('[AdhocTaskDelete] Erro ao registar actividade:', activityError)
    }

    // 9. Eliminar subtarefas
    if (subtaskCount > 0) {
      const { error: delSubError } = await adminDb.from('proc_subtasks')
        .delete()
        .eq('proc_task_id', taskId)
      if (delSubError) {
        console.error('[AdhocTaskDelete] Erro ao eliminar subtarefas:', delSubError)
      }
    }

    // 10. Eliminar tarefa
    const { error: delError } = await supabase
      .from('proc_tasks')
      .delete()
      .eq('id', taskId)

    if (delError) {
      return NextResponse.json(
        { error: 'Erro ao eliminar tarefa', details: delError.message },
        { status: 500 }
      )
    }

    // 11. Recalcular progresso
    await recalculateProgress(id)

    return NextResponse.json({
      message: 'Tarefa removida com sucesso',
      deleted_task_id: taskId,
      deleted_subtask_count: subtaskCount,
    })
  } catch (error) {
    console.error('Erro ao eliminar tarefa ad-hoc:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
