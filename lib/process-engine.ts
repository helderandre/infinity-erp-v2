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

    // 4. Determinar a fase actual (primeira fase não-completa)
    const stageProgress = new Map<number, { total: number; completed: number }>()
    for (const t of tasks) {
      const stageIdx = t.stage_order_index ?? 0
      if (!stageProgress.has(stageIdx)) {
        stageProgress.set(stageIdx, { total: 0, completed: 0 })
      }
      const sp = stageProgress.get(stageIdx)!
      sp.total++
      if (t.status === 'completed' || t.is_bypassed) {
        sp.completed++
      }
    }

    // Encontrar a primeira fase não-completa
    const sortedStages = Array.from(stageProgress.entries()).sort(([a], [b]) => a - b)
    let currentStageIdx: number | null = null
    for (const [idx, progress] of sortedStages) {
      if (progress.completed < progress.total) {
        currentStageIdx = idx
        break
      }
    }

    // 4. Verificar se está completo
    const isCompleted = percentComplete === 100

    // 5. Buscar stage_id real da tpl_stages (se tivermos o index)
    let currentStageId: string | null = null
    if (currentStageIdx !== null && !isCompleted) {
      const { data: inst } = await supabase
        .from('proc_instances')
        .select('tpl_process_id')
        .eq('id', procInstanceId)
        .single()

      if (inst?.tpl_process_id) {
        const { data: stage } = await supabase
          .from('tpl_stages')
          .select('id')
          .eq('tpl_process_id', inst.tpl_process_id)
          .eq('order_index', currentStageIdx)
          .single()

        currentStageId = stage?.id ?? null
      }
    }

    // 6. Atualizar processo
    const { error: updateError } = await supabase
      .from('proc_instances')
      .update({
        percent_complete: percentComplete,
        current_stage_id: currentStageId,
        updated_at: new Date().toISOString(),
        ...(isCompleted
          ? { current_status: 'completed', completed_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', procInstanceId)

    if (updateError) throw updateError

    return {
      percent_complete: percentComplete,
      current_stage_index: currentStageIdx,
      current_stage_id: currentStageId,
      is_completed: isCompleted,
    }
  } catch (error) {
    console.error('Error recalculating progress:', error)
    throw error
  }
}
