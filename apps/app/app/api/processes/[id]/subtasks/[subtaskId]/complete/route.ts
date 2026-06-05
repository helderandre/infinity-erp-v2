import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'
import { getRuleByKey } from '@/lib/processes/subtasks/registry'
import { propagateDueDates } from '@/lib/processes/subtasks/propagate-due-dates'
import { shiftToNextBusinessDay } from '@/lib/processes/subtasks/business-days'
import { logTaskActivity } from '@/lib/processes/activity-logger'
import type {
  ProcSubtaskRow,
  SubtaskCompleteContext,
} from '@/lib/processes/subtasks/types'

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const bodySchema = z.record(z.string(), z.unknown()).nullable().optional()

/**
 * POST /api/processes/[id]/subtasks/[subtaskId]/complete
 *
 * Fecha uma subtarefa hardcoded:
 *   1. Resolve a `rule` pelo `subtask_key`
 *   2. Invoca `rule.complete(ctx)` e captura `payload`
 *   3. UPDATE `proc_subtasks SET is_completed=true, completed_at=now(),
 *      completed_by, config.payload`
 *   4. Emite activity `'subtask_completed'`
 *   5. Chama `propagateDueDates()` — erros por sibling são isolados
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const { id: processId, subtaskId } = await params

  if (!UUID_REGEX.test(processId) || !UUID_REGEX.test(subtaskId)) {
    return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 })
  }

  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const admin = createAdminClient()

  // Carregar a subtask + proc_task + proc_instance numa query para
  // validar que pertencem ao processId recebido.
  const { data: subtaskData, error: subtaskErr } = await admin
    .from('proc_subtasks')
    .select(`
      id, proc_task_id, tpl_subtask_id, subtask_key, title, is_mandatory,
      is_completed, completed_at, completed_by, owner_id, due_date,
      assigned_to, assigned_role, priority, order_index, config,
      created_at, started_at, is_blocked, dependency_type,
      dependency_proc_subtask_id, dependency_proc_task_id, unblocked_at,
      proc_task:proc_tasks!inner(
        id,
        proc_instance_id,
        proc_instance:proc_instances!inner(
          id, property_id,
          property:dev_properties(consultant_id)
        )
      )
    `)
    .eq('id', subtaskId)
    .single()

  if (subtaskErr || !subtaskData) {
    return NextResponse.json({ error: 'Subtarefa não encontrada' }, { status: 404 })
  }

  const subtask = subtaskData as unknown as ProcSubtaskRow & {
    proc_task: {
      id: string
      proc_instance_id: string
      proc_instance: {
        id: string
        property_id: string
        property: { consultant_id: string | null } | null
      }
    }
  }

  if (subtask.proc_task.proc_instance.id !== processId) {
    return NextResponse.json(
      { error: 'Subtarefa não pertence a este processo' },
      { status: 400 }
    )
  }

  if (subtask.is_completed === true) {
    return NextResponse.json(
      { error: 'Subtarefa já está concluída', subtask_id: subtaskId },
      { status: 409 }
    )
  }

  const consultantId = subtask.proc_task.proc_instance.property?.consultant_id ?? null
  const hasPipeline = auth.permissions.pipeline === true
  if (!hasPipeline && consultantId !== auth.user.id && subtask.assigned_to !== auth.user.id) {
    return NextResponse.json(
      { error: 'Sem permissão para concluir esta subtarefa' },
      { status: 403 }
    )
  }

  const rule = getRuleByKey(subtask.subtask_key)
  if (!rule) {
    // Subtasks legacy (`legacy_tpl_*`, `legacy_adhoc_*`) não têm rule.
    // Este endpoint só serve as hardcoded. Caller deve usar o endpoint
    // legacy de PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId].
    return NextResponse.json(
      { error: 'Subtarefa sem rule no registry — usar endpoint legacy' },
      { status: 400 }
    )
  }

  // Body opcional (payload do handler).
  let body: Record<string, unknown> | null = null
  try {
    const raw = await request.text()
    if (raw && raw.length > 0) {
      const parsed = bodySchema.safeParse(JSON.parse(raw))
      if (!parsed.success) {
        return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
      }
      body = parsed.data ?? null
    }
  } catch {
    return NextResponse.json({ error: 'JSON malformado' }, { status: 400 })
  }

  const completeCtx: SubtaskCompleteContext = {
    supabase: admin,
    processId,
    procTaskId: subtask.proc_task_id,
    propertyId: subtask.proc_task.proc_instance.property_id,
    consultantId,
    owner: null,
    businessDay: (d) => shiftToNextBusinessDay(d, admin),
    userId: auth.user.id,
    subtask,
    body,
  }

  let payload: Record<string, unknown> | undefined
  try {
    const result = await rule.complete(completeCtx)
    payload = result?.payload
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json(
      { error: `Handler da rule falhou: ${msg}` },
      { status: 500 }
    )
  }

  const completedAt = new Date().toISOString()
  const nextConfig = {
    ...(subtask.config ?? {}),
    ...(payload ? { payload } : {}),
  }

  const { error: updateErr } = await admin
    .from('proc_subtasks')
    .update({
      is_completed: true,
      completed_at: completedAt,
      completed_by: auth.user.id,
      config: nextConfig,
    })
    .eq('id', subtaskId)

  if (updateErr) {
    return NextResponse.json(
      { error: `Erro ao guardar conclusão: ${updateErr.message}` },
      { status: 500 }
    )
  }

  // Refresh das colunas relevantes para propagação.
  const completedRow: ProcSubtaskRow = {
    ...subtask,
    is_completed: true,
    completed_at: completedAt,
    completed_by: auth.user.id,
    config: nextConfig,
  }

  // Activity 'subtask_completed' — visível na timeline por defeito.
  await logTaskActivity(
    admin,
    subtask.proc_task_id,
    auth.user.id,
    'subtask_completed' as never,
    `Subtarefa "${subtask.title}" concluída`,
    {
      subtask_id: subtaskId,
      subtask_key: subtask.subtask_key,
      owner_id: subtask.owner_id,
      payload: payload ?? null,
    }
  )

  // Propagação (try/catch por sibling dentro do helper — não reverte).
  const propagation = await propagateDueDates({
    supabase: admin,
    completed: completedRow,
    userId: auth.user.id,
  })

  // Audit em log_audit
  await admin.from('log_audit').insert({
    user_id: auth.user.id,
    entity_type: 'proc_subtask',
    entity_id: subtaskId,
    action: 'subtask.complete',
    new_data: {
      subtask_key: subtask.subtask_key,
      propagation,
    },
  })

  return NextResponse.json({
    ok: true,
    subtask_id: subtaskId,
    completed_at: completedAt,
    propagation,
  })
}
