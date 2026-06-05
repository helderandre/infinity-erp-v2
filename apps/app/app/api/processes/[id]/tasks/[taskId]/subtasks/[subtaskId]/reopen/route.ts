import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const reopenSchema = z.object({
  doc_id: z.string().regex(UUID_RE, 'doc_id inválido').optional(),
  reason: z.string().optional(),
})

/**
 * POST /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/reopen
 *
 * Reverts a previously-approved subtask back to pending review:
 *   - proc_subtasks.is_completed = false
 *   - proc_subtasks.completed_at/by = NULL
 *   - proc_subtasks.config.task_result.doc_registry_id cleared
 *   - If `doc_id` provided: doc_registry.status = 'under_review',
 *     keeping the file available for re-review by the consultor.
 */
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

    const body = await request.json().catch(() => ({}))
    const parsed = reopenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
        { status: 400 }
      )
    }
    const { doc_id, reason } = parsed.data

    const admin = createAdminClient() as unknown as {
      from: (t: string) => ReturnType<typeof supabase.from>
    }

    const { data: subtask, error: subErr } = await admin
      .from('proc_subtasks')
      .select('id, proc_task_id, config')
      .eq('id', subtaskId)
      .eq('proc_task_id', taskId)
      .single() as { data: any; error: any }

    if (subErr || !subtask) {
      return NextResponse.json({ error: 'Subtarefa não encontrada' }, { status: 404 })
    }

    const { data: task } = await admin
      .from('proc_tasks')
      .select('id, proc_instance_id, assigned_to')
      .eq('id', taskId)
      .single() as { data: any }

    if (!task || task.proc_instance_id !== procInstanceId) {
      return NextResponse.json({ error: 'Tarefa não pertence ao processo' }, { status: 400 })
    }

    const isAssignee = task.assigned_to === user.id
    const hasProcs = !isAssignee
      ? await hasPermissionServer(supabase, user.id, 'processes')
      : true
    if (!isAssignee && !hasProcs) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Reset task_result.doc_registry_id while keeping the rest of config.
    const cfg = (subtask.config ?? {}) as Record<string, any>
    const taskResult = (cfg.task_result ?? {}) as Record<string, any>
    delete taskResult.doc_registry_id
    const newConfig = { ...cfg, task_result: taskResult }

    const { error: stUpdErr } = await admin
      .from('proc_subtasks')
      .update({
        is_completed: false,
        completed_at: null,
        completed_by: null,
        config: newConfig,
      })
      .eq('id', subtaskId) as { error: any }

    if (stUpdErr) {
      console.error('[reopen] subtask update:', stUpdErr.message)
      return NextResponse.json({ error: stUpdErr.message }, { status: 500 })
    }

    // Mark the doc back as under_review (preserves file).
    if (doc_id) {
      await admin
        .from('doc_registry')
        .update({
          status: 'under_review',
          notes: reason ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc_id) as { error: any }
    }

    // Activity log
    await admin
      .from('proc_task_activities')
      .insert({
        proc_task_id: taskId,
        user_id: user.id,
        activity_type: 'subtask_reverted',
        description: 'Aprovação revertida — subtarefa voltou a pendente',
        metadata: {
          subtask_id: subtaskId,
          doc_id: doc_id ?? null,
          reason: reason ?? null,
        },
      }) as { error: any }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[reopen] error:', err?.message ?? err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
