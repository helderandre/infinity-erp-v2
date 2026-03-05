import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { recalculateProgress } from '@/lib/process-engine'
import { z } from 'zod'
import { notificationService } from '@/lib/notifications/service'
import { logTaskActivity } from '@/lib/processes/activity-logger'

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

      case 'reset':
        if (task.status !== 'skipped') {
          return NextResponse.json(
            { error: 'Apenas tarefas dispensadas podem ser reactivadas' },
            { status: 400 }
          )
        }
        updateData.status = 'pending'
        updateData.is_bypassed = false
        updateData.bypass_reason = null
        updateData.bypassed_by = null
        updateData.completed_at = null
        updateData.assigned_to = null
        break

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
            old_status: 'skipped',
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
