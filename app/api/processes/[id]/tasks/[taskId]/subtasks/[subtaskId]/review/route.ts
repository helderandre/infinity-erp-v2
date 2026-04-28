import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { propagateDueDates } from '@/lib/processes/subtasks/propagate-due-dates'
import { logTaskActivity } from '@/lib/processes/activity-logger'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { sendPushToOwner } from '@/lib/notifications/send-push-to-owner'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const reviewSchema = z
  .object({
    doc_id: z.string().regex(UUID_RE, 'doc_id inválido'),
    action: z.enum(['approve', 'reject']),
    reason: z.string().optional(),
  })
  .refine(
    (data) => data.action !== 'reject' || (data.reason && data.reason.trim().length >= 5),
    { message: 'Motivo é obrigatório (min 5 caracteres) ao rejeitar', path: ['reason'] }
  )

type AdminFrom = { from: (t: string) => ReturnType<ReturnType<typeof createAdminClient>['from']> }

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string; subtaskId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id: procInstanceId, taskId, subtaskId } = await params

    const body = await request.json()
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { doc_id, action, reason } = parsed.data

    const admin = createAdminClient() as unknown as AdminFrom

    // Resolve task + subtask + property + owner_id from chain
    const { data: subtaskRow, error: subErr } = await admin.from('proc_subtasks')
      .select('id, proc_task_id, subtask_key, is_completed, owner_id, completed_at, completed_by')
      .eq('id', subtaskId)
      .eq('proc_task_id', taskId)
      .single() as { data: any; error: any }

    if (subErr || !subtaskRow) {
      return NextResponse.json({ error: 'Subtarefa não encontrada' }, { status: 404 })
    }

    const { data: taskRow, error: taskErr } = await admin.from('proc_tasks')
      .select('id, proc_instance_id, assigned_to, title')
      .eq('id', taskId)
      .single() as { data: any; error: any }

    if (taskErr || !taskRow) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    if (taskRow.proc_instance_id !== procInstanceId) {
      return NextResponse.json({ error: 'Tarefa não pertence a este processo' }, { status: 400 })
    }

    // Auth: assigned_to OR has 'processes' permission
    const isAssignee = taskRow.assigned_to === user.id
    const hasProcessesPermission = !isAssignee
      ? await hasPermissionServer(supabase, user.id, 'processes')
      : true
    if (!isAssignee && !hasProcessesPermission) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Load doc
    const { data: doc, error: docErr } = await admin.from('doc_registry')
      .select('id, status, owner_id, property_id, file_name, doc_type_id, metadata, notes')
      .eq('id', doc_id)
      .single() as { data: any; error: any }

    if (docErr || !doc) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
    }

    // Validate doc belongs to this subtask. Match by metadata.subtask_id
    // (normal upload) OR metadata.signed_from_subtask_id (signed CMI doc
    // references back to the geracao_cmi subtask).
    const docSubtaskId = doc.metadata?.subtask_id
    const docSignedFromSubtaskId = doc.metadata?.signed_from_subtask_id
    if (docSubtaskId !== subtaskId && docSignedFromSubtaskId !== subtaskId) {
      return NextResponse.json(
        { error: 'Documento não pertence a esta subtarefa' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      return await handleApprove({
        admin,
        supabase,
        userId: user.id,
        doc,
        subtaskRow,
        taskRow,
      })
    }

    return await handleReject({
      admin,
      supabase,
      userId: user.id,
      doc,
      subtaskRow,
      taskRow,
      reason: (reason ?? '').trim(),
    })
  } catch (err: any) {
    console.error('[review] error:', err?.message ?? err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

async function handleApprove(args: {
  admin: AdminFrom
  supabase: any
  userId: string
  doc: any
  subtaskRow: any
  taskRow: any
}): Promise<NextResponse> {
  const { admin, supabase, userId, doc, subtaskRow, taskRow } = args

  const isCmiSigned =
    doc.metadata?.signature_method === 'canvas_png_stamped' &&
    typeof doc.metadata?.signed_from_subtask_id === 'string'

  const idempotent = doc.status === 'approved' && subtaskRow.is_completed === true

  // 1. UPDATE doc_registry status (idempotent)
  if (doc.status !== 'approved') {
    const { error: docUpdErr } = await admin.from('doc_registry')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', doc.id) as { error: any }
    if (docUpdErr) {
      console.error('[review/approve] doc update:', docUpdErr.message)
    }
  }

  // 2. CMI signed: enrich metadata with role marker
  if (isCmiSigned && !doc.metadata?.role) {
    await admin.from('doc_registry')
      .update({
        metadata: { ...(doc.metadata ?? {}), role: 'cmi_digitalizado_official' },
      })
      .eq('id', doc.id) as { error: any }
  }

  // 3. Mark subtask(s) completed (guarded by is_completed IS NOT TRUE)
  const subtasksToComplete: { id: string; subtask_key: string; proc_task_id: string }[] = []

  // Primary subtask (for normal upload OR for CMI: signed_from_subtask_id)
  const primarySubtaskId = isCmiSigned
    ? doc.metadata.signed_from_subtask_id
    : subtaskRow.id

  // Fetch primary subtask (it might be different from subtaskRow if CMI)
  const { data: primarySubtask } = isCmiSigned
    ? (await admin.from('proc_subtasks')
        .select('id, subtask_key, proc_task_id, is_completed')
        .eq('id', primarySubtaskId)
        .single() as { data: any })
    : { data: subtaskRow }

  if (primarySubtask && primarySubtask.is_completed !== true) {
    subtasksToComplete.push({
      id: primarySubtask.id,
      subtask_key: primarySubtask.subtask_key ?? subtaskRow.subtask_key,
      proc_task_id: primarySubtask.proc_task_id ?? subtaskRow.proc_task_id,
    })
  }

  // For CMI: also locate upload_cmi_digitalizado in same proc_instance
  if (isCmiSigned) {
    const { data: cmiDigitalizado } = await admin.from('proc_subtasks')
      .select('id, subtask_key, proc_task_id, is_completed, proc_tasks!proc_subtasks_proc_task_id_fkey(proc_instance_id)')
      .eq('subtask_key', 'upload_cmi_digitalizado')
      .eq('proc_tasks.proc_instance_id', taskRow.proc_instance_id)
      .maybeSingle() as { data: any }

    if (cmiDigitalizado && cmiDigitalizado.is_completed !== true) {
      subtasksToComplete.push({
        id: cmiDigitalizado.id,
        subtask_key: cmiDigitalizado.subtask_key,
        proc_task_id: cmiDigitalizado.proc_task_id,
      })
    }
  }

  let propagated = 0
  let propagationError: string | undefined

  for (const st of subtasksToComplete) {
    const { error: stUpdErr } = await admin.from('proc_subtasks')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        completed_by: userId,
      })
      .eq('id', st.id)
      .neq('is_completed', true) as { error: any }

    if (stUpdErr) {
      console.error('[review/approve] subtask update:', stUpdErr.message)
      continue
    }

    // Propagate due dates (try/catch isolated)
    try {
      const result = await propagateDueDates({
        supabase: supabase as any,
        completed: {
          id: st.id,
          proc_task_id: st.proc_task_id,
          subtask_key: st.subtask_key,
          is_completed: true,
          owner_id: subtaskRow.owner_id ?? null,
          due_date: null,
          completed_at: new Date().toISOString(),
        } as any,
        userId,
      })
      propagated += result.updated
    } catch (err: any) {
      propagationError = err?.message ?? String(err)
      console.error('[review/approve] propagate:', propagationError)
    }
  }

  // 4. Activity log
  const activityType: 'owner_cmi_signed_accepted' | 'owner_doc_approved' = isCmiSigned
    ? 'owner_cmi_signed_accepted'
    : 'owner_doc_approved'
  await logTaskActivity(
    supabase,
    taskRow.id,
    userId,
    activityType,
    isCmiSigned
      ? `Assinatura do CMI aceite (${doc.file_name})`
      : `Documento aprovado (${doc.file_name})`,
    {
      doc_id: doc.id,
      subtask_id: subtaskRow.id,
      subtask_ids: subtasksToComplete.map((s) => s.id),
      file_name: doc.file_name,
    }
  )

  return NextResponse.json({
    ok: true,
    idempotent,
    propagated_due_dates: propagated,
    propagation_error: propagationError,
    cmi_signed_accepted: isCmiSigned,
    subtasks_completed: subtasksToComplete.map((s) => s.id),
  })
}

async function handleReject(args: {
  admin: AdminFrom
  supabase: any
  userId: string
  doc: any
  subtaskRow: any
  taskRow: any
  reason: string
}): Promise<NextResponse> {
  const { admin, supabase, userId, doc, subtaskRow, taskRow, reason } = args

  // 1. UPDATE doc_registry status + notes
  const { error: docUpdErr } = await admin.from('doc_registry')
    .update({
      status: 'rejected',
      notes: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', doc.id) as { error: any }

  if (docUpdErr) {
    console.error('[review/reject] doc update:', docUpdErr.message)
  }

  // 2. Notify owner via owner_notifications + push
  let ownerNotified = false
  let pushSent = 0

  if (doc.owner_id) {
    const title = `Documento rejeitado: ${doc.file_name}`
    const ownerActionUrl =
      doc.metadata?.subtask_id
        ? `/processo/${taskRow.proc_instance_id}/checklist?subtask=${doc.metadata.subtask_id}`
        : `/processo/${taskRow.proc_instance_id}/checklist`

    const { error: ownerNotifErr } = await admin.from('owner_notifications')
      .insert({
        owner_id: doc.owner_id,
        notification_type: 'owner_doc_rejected',
        entity_type: 'doc_registry',
        entity_id: doc.id,
        title,
        body: reason,
        action_url: ownerActionUrl,
        metadata: {
          doc_id: doc.id,
          subtask_id: doc.metadata?.subtask_id,
          proc_task_id: taskRow.id,
          file_name: doc.file_name,
          rejected_by: userId,
        },
      }) as { error: any }

    if (!ownerNotifErr) {
      ownerNotified = true
    } else {
      console.error('[review/reject] owner_notifications insert:', ownerNotifErr.message)
    }

    try {
      pushSent = await sendPushToOwner(supabase, doc.owner_id, {
        title,
        body: reason,
        url: ownerActionUrl,
        tag: `owner_doc_rejected:${doc.id}`,
      })
    } catch (err: any) {
      console.error('[review/reject] push:', err?.message ?? err)
    }
  }

  // 3. Activity log on consultor side
  await logTaskActivity(
    supabase,
    taskRow.id,
    userId,
    'owner_doc_rejected',
    `Documento rejeitado (${doc.file_name})`,
    {
      doc_id: doc.id,
      subtask_id: subtaskRow.id,
      reason,
      file_name: doc.file_name,
    }
  )

  return NextResponse.json({
    ok: true,
    owner_notified: ownerNotified,
    push_sent_to_owner: pushSent > 0,
  })
}
