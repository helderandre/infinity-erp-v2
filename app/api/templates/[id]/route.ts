import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { templateSchema } from '@/lib/validations/template'
import { requirePermission } from '@/lib/auth/permissions'

// GET — Detalhe do template com fases e tarefas
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('settings')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('tpl_processes')
      .select(`
        *,
        tpl_stages (
          *,
          tpl_tasks (
            *,
            tpl_subtasks!tpl_subtasks_tpl_task_id_fkey (*)
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Ordenar stages, tasks e subtasks por order_index
    if (data.tpl_stages) {
      data.tpl_stages.sort((a: any, b: any) => a.order_index - b.order_index)
      data.tpl_stages.forEach((stage: any) => {
        if (stage.tpl_tasks) {
          stage.tpl_tasks.sort((a: any, b: any) => a.order_index - b.order_index)
          stage.tpl_tasks.forEach((task: any) => {
            if (task.tpl_subtasks) {
              task.tpl_subtasks.sort((a: any, b: any) => a.order_index - b.order_index)
            }
          })
        }
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT — Editar template (delete-and-recreate stages/tasks)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('settings')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // 1. Validar payload
    const parsed = templateSchema.safeParse(body)
    if (!parsed.success) {
      // Debug: mostrar detalhes por subtarefa
      const debugInfo: { stage: string; task: string; subtask: string; type: string; config: unknown; errors: string[] }[] = []
      if (body.stages) {
        const { subtaskSchema } = await import('@/lib/validations/template')
        for (const stage of body.stages) {
          for (const task of stage.tasks || []) {
            for (const st of task.subtasks || []) {
              const stResult = subtaskSchema.safeParse(st)
              if (!stResult.success) {
                debugInfo.push({
                  stage: stage.name,
                  task: task.title,
                  subtask: st.title,
                  type: st.type,
                  config: st.config,
                  errors: stResult.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`),
                })
              }
            }
          }
        }
      }
      console.error('[templates/PUT] Validation failed. Subtask debug:', JSON.stringify(debugInfo, null, 2))
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten(), debug: debugInfo },
        { status: 400 }
      )
    }

    const { name, description, process_type, stages } = parsed.data

    // 2. Verificar se template existe
    const { data: existing, error: existError } = await supabase
      .from('tpl_processes')
      .select('id')
      .eq('id', id)
      .single()

    if (existError || !existing) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
    }

    // 3. Update nome/descrição do processo
    const { error: updateError } = await supabase
      .from('tpl_processes')
      .update({ name, description, process_type } as any)
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 4. Apagar stages/tasks/subtasks antigas (usar admin para evitar RLS)
    const adminSupabase = createAdminClient()
    const adminDb = adminSupabase as unknown as { from: (table: string) => ReturnType<typeof adminSupabase.from> }

    const { data: existingStages } = await adminSupabase
      .from('tpl_stages')
      .select('id')
      .eq('tpl_process_id', id)

    if (existingStages && existingStages.length > 0) {
      const stageIds = existingStages.map((s) => s.id)

      // Nullificar current_stage_id em proc_instances que referenciam estas stages
      await adminSupabase
        .from('proc_instances')
        .update({ current_stage_id: null })
        .in('current_stage_id', stageIds)

      // Nullificar tpl_task_id em proc_tasks que referenciam tarefas destas stages
      const { data: existingTasks } = await adminSupabase
        .from('tpl_tasks')
        .select('id')
        .in('tpl_stage_id', stageIds)

      if (existingTasks && existingTasks.length > 0) {
        const taskIds = existingTasks.map((t) => t.id)

        await adminSupabase
          .from('proc_tasks')
          .update({ tpl_task_id: null })
          .in('tpl_task_id', taskIds)

        await (adminDb.from('tpl_subtasks') as ReturnType<typeof adminSupabase.from>)
          .delete()
          .in('tpl_task_id', taskIds)
      }

      await adminSupabase
        .from('tpl_tasks')
        .delete()
        .in('tpl_stage_id', stageIds)

      const { error: deleteStagesError } = await adminSupabase
        .from('tpl_stages')
        .delete()
        .eq('tpl_process_id', id)

      if (deleteStagesError) {
        console.error('Erro ao apagar stages:', deleteStagesError)
        return NextResponse.json(
          { error: `Erro ao apagar fases antigas: ${deleteStagesError.message}` },
          { status: 500 }
        )
      }
    }

    // Cast para aceder a tpl_subtasks
    const db = supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> }

    // Mappings: local ID → DB ID (para resolver dependências)
    const stageIdMap = new Map<string, string>()
    const taskIdMap = new Map<string, string>()
    const subtaskIdMap = new Map<string, string>()

    // Pendentes de dependência para actualizar depois
    const taskDeps: { dbId: string; localDepId: string }[] = []
    const subtaskDeps: { dbId: string; depType: string; localSubtaskId?: string; localTaskId?: string }[] = []

    // 8. Inserir novas stages e tasks
    for (const stage of stages) {
      const { data: insertedStage, error: stageError } = await supabase
        .from('tpl_stages')
        .insert({
          tpl_process_id: id,
          name: stage.name,
          description: stage.description || null,
          order_index: stage.order_index,
        })
        .select('id')
        .single()

      if (stageError || !insertedStage) {
        return NextResponse.json(
          { error: `Erro ao criar fase "${stage.name}": ${stageError?.message}` },
          { status: 500 }
        )
      }

      // Mapear ID local do estágio → ID de DB
      const stageLocalId = (stage as any)._local_id
      if (stageLocalId) {
        stageIdMap.set(stageLocalId, insertedStage.id)
      }

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

    // 9. Segundo passo: resolver dependências de tarefas
    for (const dep of taskDeps) {
      const resolvedId = taskIdMap.get(dep.localDepId)
      if (resolvedId) {
        await supabase
          .from('tpl_tasks')
          .update({ dependency_task_id: resolvedId })
          .eq('id', dep.dbId)
      }
    }

    // 10. Segundo passo: resolver dependências de subtarefas
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

    // 11. Resolver depends_on_stages (local IDs → DB IDs)
    for (const stage of stages) {
      const localDeps: string[] = (stage as any).depends_on_stages || []
      if (localDeps.length === 0) continue

      const stageLocalId = (stage as any)._local_id
      const stageDbId = stageLocalId ? stageIdMap.get(stageLocalId) : null
      if (!stageDbId) continue

      const resolvedDeps = localDeps
        .map((localId) => stageIdMap.get(localId))
        .filter((depId): depId is string => !!depId)

      if (resolvedDeps.length > 0) {
        await supabase
          .from('tpl_stages')
          .update({ depends_on_stages: resolvedDeps } as any)
          .eq('id', stageDbId)
      }
    }

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — Desactivar (is_active = false) ou eliminar (soft delete com deleted_at)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('settings')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'delete') {
      // Soft delete — marcar como eliminado
      const { error } = await supabase
        .from('tpl_processes')
        .update({ is_active: false, deleted_at: new Date().toISOString() } as any)
        .eq('id', id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, action: 'deleted' })
    }

    // Default: apenas desactivar
    const { error } = await supabase
      .from('tpl_processes')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, action: 'deactivated' })
  } catch (error) {
    console.error('Error deactivating/deleting template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
