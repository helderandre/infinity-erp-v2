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

    // 3. Determinar fase atual (primeira fase com tarefas pendentes)
    const pendingTasks = tasks
      .filter((t: any) => t.status === 'pending' && !t.is_bypassed)
      .sort((a: any, b: any) => a.stage_order_index - b.stage_order_index)

    const currentStageIndex = pendingTasks[0]?.stage_order_index

    // 4. Verificar se está completo
    const isCompleted = percentComplete === 100

    // 5. Atualizar processo
    const updates: any = {
      percent_complete: percentComplete,
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
      current_stage_index: currentStageIndex,
      is_completed: isCompleted,
    }
  } catch (error) {
    console.error('Error recalculating progress:', error)
    throw error
  }
}
