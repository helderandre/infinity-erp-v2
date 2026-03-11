import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { recalculateProgress } from '@/lib/process-engine'
import { logTaskActivity } from '@/lib/processes/activity-logger'
import { z } from 'zod'

const subtaskUpdateSchema = z
  .object({
    is_completed: z.boolean().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    priority: z.enum(['urgent', 'normal', 'low']).optional(),
    due_date: z.string().nullable().optional(),
    rendered_content: z
      .object({
        subject: z.string().optional(),
        body_html: z.string().optional(),
        content_html: z.string().optional(),
        editor_state: z.any().optional(),
      })
      .optional(),
    resend_email_id: z.string().optional(),
    email_metadata: z.object({
      sender_email: z.string().optional(),
      sender_name: z.string().optional(),
      recipient_email: z.string().optional(),
      cc: z.array(z.string()).optional(),
    }).optional(),
    task_result: z.object({
      doc_registry_id: z.string().optional(),
    }).optional(),
    reset_template: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.is_completed !== undefined ||
      data.rendered_content !== undefined ||
      data.assigned_to !== undefined ||
      data.priority !== undefined ||
      data.due_date !== undefined ||
      data.reset_template === true,
    { message: 'is_completed, rendered_content, assigned_to, priority, due_date ou reset_template são obrigatórios' }
  )

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string; subtaskId: string }> }
) {
  try {
    const { id, taskId, subtaskId } = await params
    const supabase = await createClient()
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Parse e validação
    const body = await request.json()
    const validation = subtaskUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { is_completed, rendered_content, resend_email_id, email_metadata, assigned_to, priority, due_date, reset_template } = validation.data

    // Verificar que a subtarefa existe e pertence à tarefa (admin — tabela não está nos types)
    const { data: subtask, error: subtaskError } = await adminDb.from('proc_subtasks')
      .select('id, title, config, proc_task_id, owner_id, owner:owners!proc_subtasks_owner_id_fkey(id, name, person_type)')
      .eq('id', subtaskId)
      .eq('proc_task_id', taskId)
      .single()

    if (subtaskError || !subtask) {
      return NextResponse.json({ error: 'Subtarefa não encontrada' }, { status: 404 })
    }

    // Verificar que a tarefa pertence ao processo correcto
    const { data: parentTask, error: parentTaskError } = await supabase
      .from('proc_tasks')
      .select('id, proc_instance_id')
      .eq('id', taskId)
      .eq('proc_instance_id', id)
      .single()

    if (parentTaskError || !parentTask) {
      return NextResponse.json(
        { error: 'Subtarefa não pertence a este processo' },
        { status: 404 }
      )
    }

    // Verificar se a subtarefa está bloqueada
    if ((subtask as Record<string, unknown>).is_blocked === true && is_completed !== false) {
      return NextResponse.json(
        { error: 'Esta subtarefa está bloqueada. Aguarde a conclusão da dependência.' },
        { status: 400 }
      )
    }

    // Verificar que o tipo de subtarefa permite a operação
    const config = ((subtask as Record<string, unknown>).config as Record<string, unknown>) || {}
    const subtaskType = config.type as string | undefined
    const checkType = config.check_type as string | undefined

    const isAllowedType =
      subtaskType === 'checklist' ||
      subtaskType === 'email' ||
      subtaskType === 'generate_doc' ||
      subtaskType === 'upload' ||
      subtaskType === 'form' ||
      subtaskType === 'field' ||
      checkType === 'manual'

    if (!isAllowedType) {
      return NextResponse.json(
        { error: 'Este tipo de subtarefa não suporta actualização manual' },
        { status: 400 }
      )
    }

    // Reset template — limpar config.rendered e retornar
    if (reset_template) {
      const { rendered: _removed, ...cleanConfig } = config as Record<string, unknown>
      const { error: resetError } = await adminDb.from('proc_subtasks')
        .update({ config: cleanConfig })
        .eq('id', subtaskId)

      if (resetError) {
        return NextResponse.json({ error: 'Erro ao resetar template', details: resetError.message }, { status: 500 })
      }

      // Registar actividade de reset
      try {
        const { data: currentUser } = await supabase
          .from('dev_users')
          .select('commercial_name')
          .eq('id', user.id)
          .single()
        const userName = currentUser?.commercial_name || 'Utilizador'
        const subtaskTitle = (subtask as any).title as string | undefined
        const ownerData = (subtask as any).owner as { name: string; person_type: string } | null

        const parts: string[] = []
        if (subtaskTitle) parts.push(`"${subtaskTitle}"`)
        if (ownerData?.name) parts.push(`para ${ownerData.name}`)
        const suffix = parts.length > 0 ? ` — ${parts.join(' ')}` : ''

        await logTaskActivity(supabase, taskId, user.id, 'template_reset', `${userName} resetou o template de email${suffix}`, {
          subtask_id: subtaskId,
          subtask_title: subtaskTitle,
          ...(ownerData?.name && { owner_name: ownerData.name, owner_id: (subtask as any).owner_id }),
        })
      } catch (activityError) {
        console.error('[SubtaskUpdate] Erro ao registar actividade de reset:', activityError)
      }

      return NextResponse.json({ success: true, reset: true })
    }

    // Construir o update
    const updateData: Record<string, unknown> = {}

    if (rendered_content) {
      updateData.config = { ...config, rendered: rendered_content }
    }

    if (is_completed !== undefined) {
      updateData.is_completed = is_completed
      updateData.completed_at = is_completed ? new Date().toISOString() : null
      updateData.completed_by = is_completed ? user.id : null
    }

    if (validation.data.task_result) {
      updateData.config = {
        ...config,
        task_result: is_completed ? validation.data.task_result : null,
      }
    }

    // Novos campos: assigned_to, priority, due_date
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to
    if (priority !== undefined) updateData.priority = priority
    if (due_date !== undefined) updateData.due_date = due_date

    // Executar update (admin bypassa RLS)
    const { error: updateError } = await adminDb.from('proc_subtasks')
      .update(updateData)
      .eq('id', subtaskId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao actualizar subtarefa', details: updateError.message },
        { status: 500 }
      )
    }

    // Inserir log_emails quando email é enviado com sucesso
    if (is_completed && subtaskType === 'email' && resend_email_id) {
      const { error: logError } = await adminDb.from('log_emails').insert({
        proc_task_id: taskId,
        proc_subtask_id: subtaskId,
        resend_email_id,
        recipient_email: email_metadata?.recipient_email || '',
        sender_email: email_metadata?.sender_email || null,
        sender_name: email_metadata?.sender_name || null,
        cc: email_metadata?.cc || null,
        subject: rendered_content?.subject || null,
        body_html: rendered_content?.body_html || null,
        sent_at: new Date().toISOString(),
        delivery_status: 'sent',
        last_event: 'sent',
        events: [{ type: 'sent', timestamp: new Date().toISOString() }],
        metadata: { subtask_title: (subtask as any).title },
      })
      if (logError) console.error('[log_emails] Erro ao inserir:', logError)
    }

    // Registar actividade
    try {
      const { data: currentUser } = await supabase
        .from('dev_users')
        .select('commercial_name')
        .eq('id', user.id)
        .single()
      const userName = currentUser?.commercial_name || 'Utilizador'
      const effectiveType = subtaskType || checkType || 'checklist'

      // Obter nome do proprietário e template
      const ownerData = (subtask as any).owner as { name: string; person_type: string } | null
      const ownerName = ownerData?.name
      const subtaskTitle = (subtask as any).title as string | undefined

      // Resolver nome do template (email ou doc)
      let templateName: string | undefined
      const emailLibId = config.email_library_id as string | undefined
      const docLibId = config.doc_library_id as string | undefined
      // Verificar variantes por tipo de proprietário
      const singularConfig = config.singular_config as Record<string, string> | undefined
      const coletivaConfig = config.coletiva_config as Record<string, string> | undefined
      const resolvedEmailLibId = config.has_person_type_variants
        ? (ownerData?.person_type === 'singular' ? singularConfig?.email_library_id : coletivaConfig?.email_library_id) || emailLibId
        : emailLibId
      const resolvedDocLibId = config.has_person_type_variants
        ? (ownerData?.person_type === 'singular' ? singularConfig?.doc_library_id : coletivaConfig?.doc_library_id) || docLibId
        : docLibId

      if (effectiveType === 'email' && resolvedEmailLibId) {
        const { data: tpl } = await adminDb.from('tpl_email_library').select('name').eq('id', resolvedEmailLibId).single()
        templateName = (tpl as any)?.name
      } else if (effectiveType === 'generate_doc' && resolvedDocLibId) {
        const { data: tpl } = await adminDb.from('tpl_doc_library').select('name').eq('id', resolvedDocLibId).single()
        templateName = (tpl as any)?.name
      }

      // Construir sufixo com contexto
      const parts: string[] = []
      if (templateName) parts.push(`"${templateName}"`)
      if (ownerName) parts.push(`para ${ownerName}`)
      const suffix = parts.length > 0 ? ` — ${parts.join(' ')}` : ''

      const metadata: Record<string, unknown> = {
        subtask_id: subtaskId,
        subtask_title: subtaskTitle,
        ...(ownerName && { owner_name: ownerName, owner_id: (subtask as any).owner_id }),
        ...(templateName && { template_name: templateName }),
        ...(resend_email_id && { resend_email_id }),
      }

      if (is_completed === undefined && rendered_content) {
        // Rascunho guardado
        const label = effectiveType === 'email' ? 'rascunho de email' : 'rascunho de documento'
        await logTaskActivity(supabase, taskId, user.id, 'draft_generated', `${userName} gerou ${label}${suffix}`, metadata)
      } else if (is_completed === false) {
        // Subtarefa revertida
        await logTaskActivity(
          supabase, taskId, user.id,
          'subtask_reverted',
          `${userName} reverteu "${subtaskTitle}"${suffix}`,
          { ...metadata, previous_completed_at: (subtask as any).completed_at }
        )
      } else if (is_completed) {
        // Subtarefa concluída
        if (effectiveType === 'email') {
          await logTaskActivity(supabase, taskId, user.id, 'email_sent', `${userName} enviou email${suffix}`, metadata)
        } else if (effectiveType === 'generate_doc') {
          await logTaskActivity(supabase, taskId, user.id, 'doc_generated', `${userName} gerou documento${suffix}`, metadata)
        } else if (effectiveType === 'upload') {
          await logTaskActivity(supabase, taskId, user.id, 'upload', `${userName} carregou documento${suffix}`, metadata)
        } else if (effectiveType === 'form') {
          await logTaskActivity(supabase, taskId, user.id, 'completed', `${userName} preencheu formulário "${subtaskTitle}"${suffix}`, metadata)
        } else if (effectiveType === 'field') {
          await logTaskActivity(supabase, taskId, user.id, 'completed', `${userName} preencheu campo "${subtaskTitle}"${suffix}`, metadata)
        } else {
          await logTaskActivity(supabase, taskId, user.id, 'completed', `${userName} concluiu item da checklist${suffix}`, metadata)
        }
      }
    } catch (activityError) {
      console.error('[SubtaskUpdate] Erro ao registar actividade:', activityError)
    }

    // --- Alertas configurados no template ---
    try {
      const subtaskAlerts = (config as Record<string, any>)?.alerts
      if (subtaskAlerts && is_completed) {
        if (subtaskAlerts.on_complete?.enabled) {
          const { alertService } = await import('@/lib/alerts/service')
          const { data: proc } = await supabase
            .from('proc_instances')
            .select('external_ref')
            .eq('id', id)
            .single()

          await alertService.processAlert(subtaskAlerts.on_complete, {
            procInstanceId: id,
            entityType: 'proc_subtask',
            entityId: subtaskId,
            eventType: 'on_complete',
            title: (subtask as any).title,
            processRef: proc?.external_ref || '',
            triggeredBy: user.id,
            assignedTo: (subtask as any).assigned_to,
          })
        }
      }
    } catch (alertError) {
      console.error('[SubtaskUpdate] Erro ao processar alertas:', alertError)
    }

    // Rascunho guardado — retornar
    if (is_completed === undefined) {
      return NextResponse.json({ success: true, taskStatus: null })
    }

    // Verificar estado de todas as subtarefas para recalcular a tarefa pai
    const { data: allSubtasks, error: allSubtasksError } = await adminDb.from('proc_subtasks')
      .select('is_completed, is_mandatory')
      .eq('proc_task_id', taskId)

    if (allSubtasksError) {
      return NextResponse.json({ error: 'Erro ao verificar subtarefas' }, { status: 500 })
    }

    const subtasksList = (allSubtasks || []) as Array<{
      is_completed: boolean
      is_mandatory: boolean
    }>
    const mandatorySubtasks = subtasksList.filter((s) => s.is_mandatory)
    const allMandatoryComplete = mandatorySubtasks.every((s) => s.is_completed)
    const anyComplete = subtasksList.some((s) => s.is_completed)

    let newTaskStatus: string
    if (allMandatoryComplete && mandatorySubtasks.length > 0) {
      newTaskStatus = 'completed'
    } else if (anyComplete) {
      newTaskStatus = 'in_progress'
    } else {
      newTaskStatus = 'pending'
    }

    const taskUpdate: Record<string, unknown> = {
      status: newTaskStatus,
      updated_at: new Date().toISOString(),
      completed_at: newTaskStatus === 'completed' ? new Date().toISOString() : null,
    }

    await supabase.from('proc_tasks').update(taskUpdate).eq('id', taskId)
    await recalculateProgress(id)

    return NextResponse.json({ success: true, taskStatus: newTaskStatus })
  } catch (error) {
    console.error('Erro ao actualizar subtarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
