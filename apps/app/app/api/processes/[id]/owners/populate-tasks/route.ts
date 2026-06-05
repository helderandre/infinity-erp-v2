import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { autoCompleteTasks, recalculateProgress } from '@/lib/process-engine'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST: Popula tarefas/subtarefas do processo para um proprietário específico.
 *
 * Duas estratégias conforme o template:
 *
 * A) Tasks com config.owner_type → cria novas proc_tasks com owner_id
 *    (multiplicação a nível de tarefa)
 *
 * B) Tasks genéricas (sem owner_type) com subtasks que têm owner_scope →
 *    cria novas proc_subtasks com owner_id nas proc_tasks existentes
 *    (multiplicação a nível de subtarefa)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params

    if (!UUID_REGEX.test(processId)) {
      return NextResponse.json({ error: 'processId inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { owner_id, tpl_task_id, tpl_subtask_ids } = body

    if (!owner_id || !UUID_REGEX.test(owner_id)) {
      return NextResponse.json({ error: 'owner_id inválido' }, { status: 400 })
    }

    // Modo selectivo: tpl_task_id e/ou tpl_subtask_ids para adicionar items específicos
    const isSelectiveMode = !!tpl_task_id

    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // 1. Buscar processo com template
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('id, tpl_process_id, property_id, current_status')
      .eq('id', processId)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    if (!proc.tpl_process_id) {
      return NextResponse.json(
        { error: 'Processo ainda não tem template associado (não foi aprovado)' },
        { status: 400 }
      )
    }

    if (!proc.property_id) {
      return NextResponse.json(
        { error: 'Processo não tem imóvel associado' },
        { status: 400 }
      )
    }

    // 2. Buscar owner e verificar que está ligado ao imóvel
    const { data: owner, error: ownerError } = await supabase
      .from('owners')
      .select('id, name, person_type')
      .eq('id', owner_id)
      .single()

    if (ownerError || !owner) {
      return NextResponse.json({ error: 'Proprietário não encontrado' }, { status: 404 })
    }

    const { data: junction } = await supabase
      .from('property_owners')
      .select('owner_id, is_main_contact')
      .eq('property_id', proc.property_id)
      .eq('owner_id', owner_id)
      .single()

    if (!junction) {
      return NextResponse.json(
        { error: 'Proprietário não está associado a este imóvel' },
        { status: 400 }
      )
    }

    const isMainContact = junction.is_main_contact ?? false
    const ownerType = owner.person_type // 'singular' ou 'coletiva'

    // 3. Verificar duplicados (apenas no modo "adicionar todas")
    if (!isSelectiveMode) {
      const { count: existingTaskCount } = await supabase
        .from('proc_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('proc_instance_id', processId)
        .eq('owner_id', owner_id)

      const { data: procTaskIdsForCheck } = await adminSupabase
        .from('proc_tasks')
        .select('id')
        .eq('proc_instance_id', processId)

      let existingSubCount = 0
      if (procTaskIdsForCheck && procTaskIdsForCheck.length > 0) {
        const taskIds = procTaskIdsForCheck.map((t) => t.id)
        const { count } = await adminSupabase
          .from('proc_subtasks')
          .select('id', { count: 'exact', head: true })
          .in('proc_task_id', taskIds)
          .eq('owner_id', owner_id)
        existingSubCount = count ?? 0
      }

      if ((existingTaskCount ?? 0) > 0 || existingSubCount > 0) {
        return NextResponse.json(
          { error: 'Já existem tarefas para este proprietário neste processo' },
          { status: 409 }
        )
      }
    }

    // 4. Buscar tarefas do template com subtarefas
    const { data: tplTasks, error: tplError } = await adminSupabase
      .from('tpl_tasks')
      .select(`
        id, title, action_type, config, is_mandatory, assigned_role,
        sla_days, priority, order_index,
        tpl_stage:tpl_stages!inner(name, order_index, tpl_process_id),
        tpl_subtasks:tpl_subtasks!tpl_subtasks_tpl_task_id_fkey(*)
      `)
      .eq('tpl_stage.tpl_process_id', proc.tpl_process_id)
      .order('order_index')

    if (tplError) {
      console.error('Erro ao buscar tarefas do template:', tplError)
      return NextResponse.json(
        { error: 'Erro ao buscar tarefas do template' },
        { status: 500 }
      )
    }

    let tasksCreated = 0
    let subtasksCreated = 0

    // ─── Estratégia A: Tasks com owner_type → criar novas proc_tasks ───
    const ownerTypeTasks = (tplTasks || []).filter((t: any) => {
      const taskOwnerType = (t.config as Record<string, unknown>)?.owner_type
      return taskOwnerType && taskOwnerType === ownerType
    })

    for (const task of ownerTypeTasks) {
      const stage = task.tpl_stage as any
      const dueDate = task.sla_days
        ? new Date(Date.now() + task.sla_days * 24 * 60 * 60 * 1000).toISOString()
        : null

      const { data: newTask, error: insertError } = await adminSupabase
        .from('proc_tasks')
        .insert({
          proc_instance_id: processId,
          tpl_task_id: task.id,
          title: `${task.title} — ${owner.name}`,
          action_type: task.action_type,
          config: { ...(task.config as Record<string, unknown>), owner_id: owner_id },
          status: 'pending',
          is_mandatory: task.is_mandatory,
          assigned_role: task.assigned_role,
          due_date: dueDate,
          stage_name: stage.name,
          stage_order_index: stage.order_index,
          order_index: task.order_index,
          owner_id: owner_id,
          priority: task.priority,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error(`Erro ao criar tarefa ${task.title}:`, insertError)
        continue
      }

      tasksCreated++

      // Criar subtarefas para a nova task
      if (newTask && task.tpl_subtasks) {
        const sorted = (task.tpl_subtasks as any[]).sort((a: any, b: any) => a.order_index - b.order_index)
        for (const subtask of sorted) {
          const result = createSubtaskInsert(subtask, newTask.id, owner_id, ownerType, isMainContact)
          if (result) {
            await adminSupabase.from('proc_subtasks').insert(result as any)
            subtasksCreated++
          }
        }
      }
    }

    // ─── Estratégia B: Tasks genéricas → criar subtarefas nas proc_tasks existentes ───
    let genericTasks = (tplTasks || []).filter((t: any) => {
      const taskOwnerType = (t.config as Record<string, unknown>)?.owner_type
      return !taskOwnerType // sem owner_type = genérica
    })

    // Em modo selectivo, filtrar por tpl_task_id
    if (isSelectiveMode) {
      genericTasks = genericTasks.filter((t: any) => t.id === tpl_task_id)
    }

    // Buscar subtasks já existentes para este owner (evitar duplicados em modo selectivo)
    const allProcTaskIds = (await adminSupabase
      .from('proc_tasks')
      .select('id')
      .eq('proc_instance_id', processId)).data?.map((t) => t.id) || []

    const existingOwnerSubtasks = new Set<string>()
    if (allProcTaskIds.length > 0) {
      const { data: existingSubs } = await adminSupabase
        .from('proc_subtasks')
        .select('tpl_subtask_id')
        .in('proc_task_id', allProcTaskIds)
        .eq('owner_id', owner_id)
      if (existingSubs) {
        for (const s of existingSubs) {
          if (s.tpl_subtask_id) existingOwnerSubtasks.add(s.tpl_subtask_id)
        }
      }
    }

    for (const tplTask of genericTasks) {
      let subtasksWithScope = ((tplTask.tpl_subtasks as any[]) || []).filter((st: any) => {
        const scope = (st.config as Record<string, unknown>)?.owner_scope
        return scope && scope !== 'none'
      })

      // Em modo selectivo com tpl_subtask_ids, filtrar apenas os pedidos
      if (isSelectiveMode && Array.isArray(tpl_subtask_ids) && tpl_subtask_ids.length > 0) {
        subtasksWithScope = subtasksWithScope.filter((st: any) => tpl_subtask_ids.includes(st.id))
      }

      if (subtasksWithScope.length === 0) continue

      // Encontrar a proc_task existente para este tpl_task
      const { data: existingProcTasks } = await adminSupabase
        .from('proc_tasks')
        .select('id')
        .eq('proc_instance_id', processId)
        .eq('tpl_task_id', tplTask.id)
        .is('owner_id', null) // task genérica (não owner-specific)

      if (!existingProcTasks || existingProcTasks.length === 0) continue

      const procTaskId = existingProcTasks[0].id

      for (const subtask of subtasksWithScope) {
        // Saltar se já existe para este owner
        if (existingOwnerSubtasks.has(subtask.id)) continue

        const result = createSubtaskInsert(subtask, procTaskId, owner_id, ownerType, isMainContact)
        if (result) {
          const { error: subError } = await adminSupabase.from('proc_subtasks').insert(result as any)
          if (!subError) subtasksCreated++
        }
      }
    }

    const totalCreated = tasksCreated + subtasksCreated

    if (totalCreated === 0) {
      return NextResponse.json({
        success: true,
        tasks_created: 0,
        subtasks_created: 0,
        owner_name: owner.name,
      })
    }

    // 7. Auto-completar tarefas UPLOAD e recalcular progresso
    try {
      await autoCompleteTasks(processId, proc.property_id)
    } catch (e) {
      console.error('Erro no auto-complete após populate-tasks:', e)
    }

    try {
      await recalculateProgress(processId)
    } catch (e) {
      console.error('Erro ao recalcular progresso após populate-tasks:', e)
    }

    return NextResponse.json({
      success: true,
      tasks_created: tasksCreated,
      subtasks_created: subtasksCreated,
      owner_name: owner.name,
    })
  } catch (error) {
    console.error('Erro ao popular tarefas para proprietário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * Cria o objecto de inserção para uma proc_subtask,
 * aplicando filtros de owner_scope e person_type_filter.
 * Retorna null se a subtask não deve ser criada para este owner.
 */
function createSubtaskInsert(
  tplSubtask: any,
  procTaskId: string,
  ownerId: string,
  ownerType: string,
  isMainContact: boolean,
): Record<string, unknown> | null {
  const config = (tplSubtask.config || {}) as Record<string, unknown>
  const ownerScope = config.owner_scope as string | undefined
  const personTypeFilter = config.person_type_filter as string | undefined
  const hasVariants = config.has_person_type_variants as boolean | undefined

  // Sem owner_scope ou 'none' → não criar para este owner
  if (!ownerScope || ownerScope === 'none') return null

  // Filtro de main_contact_only
  if (ownerScope === 'main_contact_only' && !isMainContact) return null

  // Filtro de person_type
  if (personTypeFilter && personTypeFilter !== 'all' && personTypeFilter !== ownerType) return null

  // Resolver config por person_type se tem variantes
  let resolvedConfig = { ...config }
  if (hasVariants) {
    const variantKey = `${ownerType}_config`
    if (resolvedConfig[variantKey]) {
      resolvedConfig = { ...resolvedConfig, ...(resolvedConfig[variantKey] as Record<string, unknown>) }
    }
  }

  const dueDate = tplSubtask.sla_days
    ? new Date(Date.now() + tplSubtask.sla_days * 24 * 60 * 60 * 1000).toISOString()
    : null

  return {
    proc_task_id: procTaskId,
    tpl_subtask_id: tplSubtask.id,
    title: tplSubtask.title,
    is_mandatory: tplSubtask.is_mandatory,
    order_index: tplSubtask.order_index,
    config: resolvedConfig,
    owner_id: ownerId,
    due_date: dueDate,
    assigned_role: tplSubtask.assigned_role,
    priority: tplSubtask.priority,
  }
}
