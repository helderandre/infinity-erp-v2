import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { templateSchema } from '@/lib/validations/template'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const processType = searchParams.get('process_type') || ''

    // Buscar templates com contagem de stages e tasks
    let query = supabase
      .from('tpl_processes')
      .select(`
        *,
        tpl_stages (
          id,
          tpl_tasks (id)
        )
      `)
      .is('deleted_at' as any, null)
      .order('created_at', { ascending: false })

    if (processType) {
      query = query.eq('process_type' as any, processType)
    }

    const { data: templates, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calcular contagens
    const templatesWithCounts = templates?.map((tpl) => {
      const stages = tpl.tpl_stages || []
      const totalTasks = stages.reduce(
        (acc, stage: any) => acc + (stage.tpl_tasks?.length || 0),
        0
      )

      return {
        id: tpl.id,
        name: tpl.name,
        description: tpl.description,
        is_active: tpl.is_active,
        created_at: tpl.created_at,
        process_type: (tpl as any).process_type,
        stages_count: stages.length,
        tasks_count: totalTasks,
      }
    })

    return NextResponse.json(templatesWithCounts)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST — Criar template completo
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // 1. Validar payload
    const parsed = templateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, description, process_type, stages } = parsed.data

    // 2. Inserir tpl_processes
    const { data: process, error: processError } = await supabase
      .from('tpl_processes')
      .insert({ name, description, process_type } as any)
      .select('id')
      .single()

    if (processError || !process) {
      return NextResponse.json(
        { error: processError?.message || 'Erro ao criar template' },
        { status: 500 }
      )
    }

    // Cast para aceder a tpl_subtasks
    const db = supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> }

    // Mappings: local ID → DB ID (para resolver dependências)
    const taskIdMap = new Map<string, string>()
    const subtaskIdMap = new Map<string, string>()

    // Pendentes de dependência para actualizar depois
    const taskDeps: { dbId: string; localDepId: string }[] = []
    const subtaskDeps: { dbId: string; depType: string; localSubtaskId?: string; localTaskId?: string }[] = []

    // 3. Inserir tpl_stages + tpl_tasks + tpl_subtasks
    for (const stage of stages) {
      const { data: insertedStage, error: stageError } = await supabase
        .from('tpl_stages')
        .insert({
          tpl_process_id: process.id,
          name: stage.name,
          description: stage.description || null,
          order_index: stage.order_index,
        })
        .select('id')
        .single()

      if (stageError || !insertedStage) {
        await supabase.from('tpl_processes').delete().eq('id', process.id)
        return NextResponse.json(
          { error: `Erro ao criar fase "${stage.name}": ${stageError?.message}` },
          { status: 500 }
        )
      }

      // Inserir tarefas (sem dependency_task_id — será resolvido no 2º passo)
      const tasksToInsert = stage.tasks.map((task) => ({
        tpl_stage_id: insertedStage.id,
        title: task.title,
        description: task.description || null,
        action_type: 'COMPOSITE',
        is_mandatory: task.is_mandatory,
        priority: task.priority || 'normal',
        sla_days: task.sla_days || null,
        assigned_role: task.assigned_role || null,
        config: task.config || {},
        order_index: task.order_index,
      }))

      const { error: tasksError } = await supabase
        .from('tpl_tasks')
        .insert(tasksToInsert as any)

      if (tasksError) {
        await supabase.from('tpl_processes').delete().eq('id', process.id)
        return NextResponse.json(
          { error: `Erro ao criar tarefas: ${tasksError.message}` },
          { status: 500 }
        )
      }

      // Buscar tasks inseridas para obter IDs reais
      const { data: insertedTasks } = await supabase
        .from('tpl_tasks')
        .select('id, order_index')
        .eq('tpl_stage_id', insertedStage.id)
        .order('order_index')

      if (insertedTasks) {
        for (let i = 0; i < stage.tasks.length; i++) {
          const task = stage.tasks[i]
          const localTaskId = task._local_id
          if (localTaskId && insertedTasks[i]) {
            taskIdMap.set(localTaskId, insertedTasks[i].id)
          }

          // Registar dependência de tarefa para resolver depois
          const depTaskId = task.dependency_task_id
          if (depTaskId && insertedTasks[i]) {
            taskDeps.push({ dbId: insertedTasks[i].id, localDepId: depTaskId })
          }

          // Inserir subtarefas
          const subtasks = task.subtasks
          if (subtasks && subtasks.length > 0 && insertedTasks[i]) {
            const subtasksToInsert = subtasks.map((st, idx) => ({
              tpl_task_id: insertedTasks[i].id,
              title: st.title,
              description: st.description || null,
              is_mandatory: st.is_mandatory,
              order_index: idx,
              sla_days: st.sla_days || null,
              assigned_role: st.assigned_role || null,
              priority: st.priority || 'normal',
              config: {
                type: st.type,
                ...(st.config as Record<string, unknown> || {}),
              },
            }))

            const { data: insertedSubtasks, error: subtasksError } = await (db.from('tpl_subtasks') as ReturnType<typeof supabase.from>)
              .insert(subtasksToInsert)
              .select('id, order_index')

            if (subtasksError) {
              await supabase.from('tpl_processes').delete().eq('id', process.id)
              return NextResponse.json(
                { error: `Erro ao criar subtarefas: ${subtasksError.message}` },
                { status: 500 }
              )
            }

            // Mapear IDs locais das subtarefas
            if (insertedSubtasks) {
              const sortedInserted = (insertedSubtasks as { id: string; order_index: number }[])
                .sort((a, b) => a.order_index - b.order_index)
              for (let j = 0; j < subtasks.length; j++) {
                const localSubtaskId = subtasks[j]._local_id
                if (localSubtaskId && sortedInserted[j]) {
                  subtaskIdMap.set(localSubtaskId, sortedInserted[j].id)
                }

                // Registar dependência de subtarefa
                const depType = subtasks[j].dependency_type
                if (depType && depType !== 'none' && sortedInserted[j]) {
                  subtaskDeps.push({
                    dbId: sortedInserted[j].id,
                    depType,
                    localSubtaskId: subtasks[j].dependency_subtask_id || undefined,
                    localTaskId: subtasks[j].dependency_task_id || undefined,
                  })
                }
              }
            }
          }
        }
      }
    }

    // 4. Segundo passo: resolver dependências de tarefas
    for (const dep of taskDeps) {
      const resolvedId = taskIdMap.get(dep.localDepId)
      if (resolvedId) {
        await supabase
          .from('tpl_tasks')
          .update({ dependency_task_id: resolvedId })
          .eq('id', dep.dbId)
      }
    }

    // 5. Segundo passo: resolver dependências de subtarefas
    for (const dep of subtaskDeps) {
      const update: Record<string, unknown> = { dependency_type: dep.depType }

      if (dep.depType === 'subtask' && dep.localSubtaskId) {
        const resolvedId = subtaskIdMap.get(dep.localSubtaskId)
        if (resolvedId) update.dependency_subtask_id = resolvedId
      }

      if (dep.depType === 'task' && dep.localTaskId) {
        const resolvedId = taskIdMap.get(dep.localTaskId)
        if (resolvedId) update.dependency_task_id = resolvedId
      }

      await (db.from('tpl_subtasks') as ReturnType<typeof supabase.from>)
        .update(update)
        .eq('id', dep.dbId)
    }

    return NextResponse.json({ id: process.id }, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
