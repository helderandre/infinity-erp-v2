import { createAdminClient } from '@/lib/supabase/admin'
import {
  autoCompleteTasks,
  recalculateProgress,
  resolveTemplate,
} from '@/lib/process-engine'
import { populateSubtasks } from '@/lib/processes/subtasks/populate'

/**
 * Activates a process instance directly — no pending_approval, no manual
 * template picker. Used by:
 *   • POST /api/acquisitions  (real pedido de angariação)
 *   • POST /api/properties    (synthetic placeholder for direct-create imóveis)
 *
 * The legacy /api/processes/[id]/{approve,reject,return} endpoints + the
 * <ProcessReviewSection> UI were removed in 2026-06-03 — there is only one
 * active angariação template, so the manual approval picker has nothing to
 * pick. If autoActivateProcess fails, the row stays at pending_approval and
 * needs developer intervention.
 *
 * Behavior:
 *   1. Auto-resolve the single active template for the given process_type
 *      (errors out if none or ambiguous).
 *   2. UPDATE proc_instances to wire the template, set status, mark approval
 *      audit fields. `markCompleted=true` fast-forwards the row to a 100%
 *      completed synthetic state (used for direct-property-create).
 *   3. Populate tasks via RPC + resolve dependencies + auto-complete UPLOAD
 *      tasks that already have docs + recalculate progress.
 *   4. Populate hardcoded subtasks (angariação only).
 *   5. When `markCompleted`, mark all just-populated tasks/subtasks as
 *      completed and force percent_complete=100 (overrides recalculation).
 *   6. Update property.status to 'in_process' for non-synthetic activations.
 *
 * Returns the resolved template id/name so callers can use them in toast/
 * notification copy. Throws on hard failures (no template, RPC error on
 * populate); soft failures (auto-complete, deps resolution) are logged but
 * don't abort.
 */
export interface AutoActivateResult {
  tpl_process_id: string
  template_name: string
}

export async function autoActivateProcess(params: {
  instanceId: string
  processType: 'angariacao' | 'negocio'
  approverId: string
  /** When true, fast-forwards the process to a completed/100% synthetic state. */
  markCompleted?: boolean
  /** Property id, if any — used to flip dev_properties.status='in_process' on real activations. */
  propertyId?: string | null
}): Promise<AutoActivateResult> {
  const { instanceId, processType, approverId, markCompleted = false, propertyId } = params
  const admin = createAdminClient()

  // ── 1. Resolve template ──────────────────────────────────────────
  const resolved = await resolveTemplate(admin as unknown as { from: (t: string) => unknown } as never, {
    process_type: processType,
  })
  if (!resolved.ok) {
    throw new Error(
      resolved.reason === 'no_candidates'
        ? `Nenhum template activo para process_type='${processType}'`
        : `Múltiplos templates activos para process_type='${processType}' — resolve manualmente`,
    )
  }
  const tpl_process_id = resolved.template.id
  const template_name = resolved.template.name

  // ── 2. Wire template + status onto the instance ──────────────────
  const nowIso = new Date().toISOString()
  const { error: updateError } = await admin
    .from('proc_instances')
    .update({
      tpl_process_id,
      current_status: markCompleted ? 'completed' : 'active',
      approved_by: approverId,
      approved_at: nowIso,
      started_at: nowIso,
      completed_at: markCompleted ? nowIso : null,
      percent_complete: markCompleted ? 100 : 0,
      returned_reason: null,
      updated_at: nowIso,
    })
    .eq('id', instanceId)

  if (updateError) {
    throw new Error(`Erro ao actualizar processo: ${updateError.message}`)
  }

  // ── 3. Populate template tasks ───────────────────────────────────
  const { error: populateError } = await admin.rpc('populate_process_tasks', {
    p_instance_id: instanceId,
  })
  if (populateError) {
    throw new Error(`Erro ao popular tarefas: ${populateError.message}`)
  }

  // Resolve task dependencies (best-effort). RPC isn't in the generated
  // types so we cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: depsError } = await (admin.rpc as any)(
    'resolve_process_dependencies',
    { p_instance_id: instanceId },
  )
  if (depsError) {
    console.error('[autoActivateProcess] resolve_process_dependencies falhou:', depsError)
  }

  // Auto-complete UPLOAD tasks with existing documents (real pedidos only — for
  // synthetics every task is going to be flipped completed below anyway).
  if (!markCompleted && propertyId) {
    try {
      await autoCompleteTasks(instanceId, propertyId)
    } catch (err) {
      console.error('[autoActivateProcess] autoCompleteTasks falhou:', err)
    }
  }

  // ── 4. Populate hardcoded subtasks (angariação only) ─────────────
  if (processType === 'angariacao') {
    try {
      await populateSubtasks(admin, instanceId, 'angariacao')
    } catch (err) {
      console.error('[autoActivateProcess] populateSubtasks falhou:', err)
    }
  }

  // ── 5. Fast-forward to completed (synthetic) ─────────────────────
  if (markCompleted) {
    // Mark every populated task + subtask as completed so the UI shows the
    // full process at 100% with a uniform completed state.
    await admin
      .from('proc_subtasks')
      .update({ is_completed: true, updated_at: nowIso })
      .eq('proc_instance_id', instanceId)

    await admin
      .from('proc_tasks')
      .update({
        status: 'completed',
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('proc_instance_id', instanceId)
      .neq('status', 'completed')

    // Force final state — override anything recalculateProgress would set.
    await admin
      .from('proc_instances')
      .update({
        percent_complete: 100,
        current_status: 'completed',
        completed_at: nowIso,
      })
      .eq('id', instanceId)
  } else {
    try {
      await recalculateProgress(instanceId)
    } catch (err) {
      console.error('[autoActivateProcess] recalculateProgress falhou:', err)
    }
  }

  // ── 6. Update property status (skip for synthetics — keeps the public
  // listing status untouched when an admin shortcuts via direct property
  // create) ───────────────────────────────────────────────────────
  if (!markCompleted && propertyId) {
    const { error: propError } = await admin
      .from('dev_properties')
      .update({ status: 'in_process' })
      .eq('id', propertyId)
    if (propError) {
      console.error('[autoActivateProcess] update dev_properties.status falhou:', propError)
    }
  }

  return { tpl_process_id, template_name }
}
