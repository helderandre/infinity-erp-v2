import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Auto-completa tarefas de UPLOAD que já têm documentos existentes
 * Chamado após aprovação do processo
 */
export async function autoCompleteTasks(
  procInstanceId: string,
  propertyId: string
) {
  const supabase = createAdminClient()

  try {
    // 1. Buscar tarefas UPLOAD do processo
    const { data: tasks, error: tasksError } = await supabase
      .from('proc_tasks')
      .select('id, config')
      .eq('proc_instance_id', procInstanceId)
      .eq('action_type', 'UPLOAD')
      .eq('status', 'pending')

    if (tasksError) throw tasksError

    if (!tasks || tasks.length === 0) {
      return { completed: 0, total: 0 }
    }

    // 2. Buscar documentos do imóvel
    const { data: propertyDocs, error: propertyDocsError } = await supabase
      .from('doc_registry')
      .select('id, doc_type_id, valid_until, owner_id')
      .eq('property_id', propertyId)
      .eq('status', 'active')

    if (propertyDocsError) throw propertyDocsError

    // 3. Buscar owners do imóvel
    const { data: propertyOwners, error: ownersError } = await supabase
      .from('property_owners')
      .select('owner_id')
      .eq('property_id', propertyId)

    if (ownersError) throw ownersError

    const ownerIds = propertyOwners?.map((po) => po.owner_id) ?? []

    // 4. Buscar documentos dos owners (reutilizáveis)
    let ownerDocs: NonNullable<typeof propertyDocs> = []
    if (ownerIds.length > 0) {
      const { data, error: ownerDocsError } = await supabase
        .from('doc_registry')
        .select('id, doc_type_id, valid_until, owner_id')
        .in('owner_id', ownerIds)
        .is('property_id', null) // Documentos reutilizáveis
        .eq('status', 'active')

      if (ownerDocsError) throw ownerDocsError
      ownerDocs = data ?? []
    }

    const allDocs = [...(propertyDocs ?? []), ...ownerDocs]

    // 5. Auto-completar tarefas que têm documentos válidos
    let completedCount = 0

    for (const task of tasks) {
      const docTypeId = (task.config as Record<string, unknown>)?.doc_type_id
      if (!docTypeId) continue

      // Procurar documento válido
      const matchingDoc = allDocs.find((doc) => {
        if (doc.doc_type_id !== docTypeId) return false
        if (!doc.valid_until) return true // Sem validade
        return new Date(doc.valid_until) > new Date() // Ainda válido
      })

      if (matchingDoc) {
        // Completar tarefa
        const { error: updateError } = await supabase
          .from('proc_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            task_result: {
              doc_registry_id: matchingDoc.id,
              auto_completed: true,
              source: matchingDoc.owner_id
                ? 'owner_existing_document'
                : 'acquisition_form',
            },
          })
          .eq('id', task.id)

        if (!updateError) completedCount++
      }
    }

    return { completed: completedCount, total: tasks.length }
  } catch (error) {
    console.error('Error auto-completing tasks:', error)
    throw error
  }
}

/**
 * Recalcula o progresso do processo baseado nas subtarefas e tarefas.
 * Tarefas com subtarefas contribuem proporcionalmente (subtarefas concluídas / total).
 * Tarefas sem subtarefas: concluída/dispensada = 1, caso contrário = 0.
 */
export async function recalculateProgress(procInstanceId: string) {
  const supabase = createAdminClient()

  try {
    // 1. Buscar todas as tarefas do processo
    const { data: tasks, error: tasksError } = await supabase
      .from('proc_tasks')
      .select('id, status, is_bypassed, is_mandatory, stage_order_index')
      .eq('proc_instance_id', procInstanceId)

    if (tasksError) throw tasksError

    if (!tasks || tasks.length === 0) {
      return { percent_complete: 0 }
    }

    // 2. Buscar subtarefas de todas as tarefas do processo
    const taskIds = tasks.map((t) => t.id)
    const { data: subtasks, error: subtasksError } = await supabase
      .from('proc_subtasks')
      .select('id, proc_task_id, is_completed')
      .in('proc_task_id', taskIds)

    if (subtasksError) throw subtasksError

    // Agrupar subtarefas por tarefa
    const subtasksByTask = new Map<string, { total: number; completed: number }>()
    for (const st of subtasks ?? []) {
      const entry = subtasksByTask.get(st.proc_task_id) ?? { total: 0, completed: 0 }
      entry.total++
      if (st.is_completed) entry.completed++
      subtasksByTask.set(st.proc_task_id, entry)
    }

    // 3. Calcular progresso com granularidade de subtarefas
    let totalWeight = 0
    let completedWeight = 0

    for (const t of tasks) {
      totalWeight++
      const stInfo = subtasksByTask.get(t.id)

      if (t.status === 'completed' || t.is_bypassed) {
        // Tarefa totalmente concluída
        completedWeight++
      } else if (stInfo && stInfo.total > 0) {
        // Tarefa com subtarefas — contribuição proporcional
        completedWeight += stInfo.completed / stInfo.total
      }
      // Tarefa sem subtarefas e não concluída = 0
    }

    const percentComplete = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0

    // 4. Verificar se está completo
    const isCompleted = percentComplete === 100

    // 5. Buscar instância e estágios do template para calcular current_stage_ids
    const { data: inst } = await supabase
      .from('proc_instances')
      .select('tpl_process_id, completed_stage_ids')
      .eq('id', procInstanceId)
      .single()

    let currentStageIds: string[] = []
    let currentStageId: string | null = null

    if (inst?.tpl_process_id && !isCompleted) {
      const { data: allStages } = await supabase
        .from('tpl_stages')
        .select('id, order_index, depends_on_stages')
        .eq('tpl_process_id', inst.tpl_process_id)
        .order('order_index')

      if (allStages) {
        currentStageIds = calculateCurrentStages(allStages, inst.completed_stage_ids || [])
        currentStageId = currentStageIds[0] || null
      }
    }

    // 6. Atualizar processo
    const { error: updateError } = await supabase
      .from('proc_instances')
      .update({
        percent_complete: percentComplete,
        current_stage_id: currentStageId,
        current_stage_ids: currentStageIds,
        updated_at: new Date().toISOString(),
        ...(isCompleted
          ? { current_status: 'completed', completed_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', procInstanceId)

    if (updateError) throw updateError

    return {
      percent_complete: percentComplete,
      current_stage_ids: currentStageIds,
      current_stage_id: currentStageId,
      is_completed: isCompleted,
    }
  } catch (error) {
    console.error('Error recalculating progress:', error)
    throw error
  }
}

/**
 * Calcula quais estágios estão activos com base nos concluídos e dependências.
 * Estágios sem dependências seguem fluxo sequencial (para no primeiro não-concluído).
 * Estágios com dependências ficam disponíveis quando todas as deps estiverem concluídas.
 */
export function calculateCurrentStages(
  allStages: { id: string; order_index: number; depends_on_stages: string[] | null }[],
  completedStageIds: string[]
): string[] {
  const completed = new Set(completedStageIds)
  const sorted = [...allStages].sort((a, b) => a.order_index - b.order_index)
  const currentStages: string[] = []

  for (const stage of sorted) {
    if (completed.has(stage.id)) continue

    const deps = stage.depends_on_stages || []
    const depsOk = deps.every(depId => completed.has(depId))
    if (!depsOk) continue

    currentStages.push(stage.id)

    // Sem dependências explícitas → fluxo sequencial (parar no primeiro)
    if (deps.length === 0 && currentStages.length > 0) {
      break
    }
  }

  return currentStages
}
