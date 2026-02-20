import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Auto-completa tarefas de UPLOAD que já têm documentos existentes
 * Chamado após aprovação do processo
 */
export async function autoCompleteTasks(
  procInstanceId: string,
  propertyId: string
) {
  const supabase = createAdminClient() as any

  try {
    // 1. Buscar tarefas UPLOAD do processo
    const { data: tasks, error: tasksError } = await (supabase as any)
      .from('proc_tasks' as any)
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

    const ownerIds = propertyOwners?.map((po: any) => po.owner_id) || []

    // 4. Buscar documentos dos owners (reutilizáveis)
    let ownerDocs: any[] = []
    if (ownerIds.length > 0) {
      const { data, error: ownerDocsError } = await supabase
        .from('doc_registry')
        .select('id, doc_type_id, valid_until, owner_id')
        .in('owner_id', ownerIds)
        .is('property_id', null) // Documentos reutilizáveis
        .eq('status', 'active')

      if (ownerDocsError) throw ownerDocsError
      ownerDocs = data || []
    }

    const allDocs = [...(propertyDocs || []), ...ownerDocs]

    // 5. Auto-completar tarefas que têm documentos válidos
    let completedCount = 0

    for (const task of tasks) {
      const docTypeId = task.config?.doc_type_id
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
          .from('proc_tasks' as any)
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
 * Recalcula o progresso do processo baseado nas tarefas
 * Chamado após qualquer mudança em tarefas
 */
export async function recalculateProgress(procInstanceId: string) {
  const supabase = createAdminClient() as any

  try {
    // 1. Buscar todas as tarefas do processo
    const { data: tasks, error: tasksError } = await supabase
      .from('proc_tasks' as any)
      .select('id, status, is_bypassed, is_mandatory, stage_order_index')
      .eq('proc_instance_id', procInstanceId)

    if (tasksError) throw tasksError

    if (!tasks || tasks.length === 0) {
      return { percent_complete: 0 }
    }

    // 2. Calcular progresso
    const total = tasks.length
    const completed = tasks.filter(
      (t: any) => t.status === 'completed' || t.is_bypassed
    ).length
    const percentComplete = Math.round((completed / total) * 100)

    // 3. Determinar a fase actual (primeira fase não-completa)
    const stageProgress = new Map<number, { total: number; completed: number }>()
    for (const t of tasks) {
      const stageIdx = (t as any).stage_order_index ?? 0
      if (!stageProgress.has(stageIdx)) {
        stageProgress.set(stageIdx, { total: 0, completed: 0 })
      }
      const sp = stageProgress.get(stageIdx)!
      sp.total++
      if ((t as any).status === 'completed' || (t as any).is_bypassed) {
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

        currentStageId = stage?.id || null
      }
    }

    // 6. Atualizar processo
    const updates: any = {
      percent_complete: percentComplete,
      current_stage_id: currentStageId,
      updated_at: new Date().toISOString(),
    }

    if (isCompleted) {
      updates.current_status = 'completed'
      updates.completed_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('proc_instances')
      .update(updates)
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
