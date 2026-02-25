import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { templateSchema } from '@/lib/validations/template'

// GET — Detalhe do template com fases e tarefas
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
            tpl_subtasks (*)
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
    const { id } = await params
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

    const { name, description, stages } = parsed.data

    // 2. Verificar se template existe
    const { data: existing, error: existError } = await supabase
      .from('tpl_processes')
      .select('id')
      .eq('id', id)
      .single()

    if (existError || !existing) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
    }

    // 3. Verificar instâncias activas (não permitir edição completa)
    const { count: activeInstances } = await supabase
      .from('proc_instances')
      .select('*', { count: 'exact', head: true })
      .eq('tpl_process_id', id)
      .not('current_status', 'in', '("completed","cancelled")')

    if (activeInstances && activeInstances > 0) {
      // Apenas permitir editar nome e descrição
      const { error: updateError } = await supabase
        .from('tpl_processes')
        .update({ name, description })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({
        id,
        warning: 'Template tem instâncias activas. Apenas nome e descrição foram actualizados.',
      })
    }

    // 4. Update nome/descrição do processo
    const { error: updateError } = await supabase
      .from('tpl_processes')
      .update({ name, description })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 5. Buscar IDs das stages actuais para apagar tasks
    const { data: existingStages } = await supabase
      .from('tpl_stages')
      .select('id')
      .eq('tpl_process_id', id)

    if (existingStages && existingStages.length > 0) {
      const stageIds = existingStages.map((s) => s.id)

      // 6. Buscar task IDs para apagar subtasks primeiro
      const { data: existingTasks } = await supabase
        .from('tpl_tasks')
        .select('id')
        .in('tpl_stage_id', stageIds)

      if (existingTasks && existingTasks.length > 0) {
        const taskIds = existingTasks.map((t) => t.id)
        const db = supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> }
        await (db.from('tpl_subtasks') as ReturnType<typeof supabase.from>)
          .delete()
          .in('tpl_task_id', taskIds)
      }

      // 7. Apagar todas as tasks das stages
      await supabase
        .from('tpl_tasks')
        .delete()
        .in('tpl_stage_id', stageIds)

      // 8. Apagar todas as stages
      await supabase
        .from('tpl_stages')
        .delete()
        .eq('tpl_process_id', id)
    }

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

      const tasksToInsert = stage.tasks.map((task) => ({
        tpl_stage_id: insertedStage.id,
        title: task.title,
        description: task.description || null,
        action_type: 'COMPOSITE',
        is_mandatory: task.is_mandatory,
        sla_days: task.sla_days || null,
        assigned_role: task.assigned_role || null,
        config: {},
        order_index: task.order_index,
      }))

      const { error: tasksError } = await supabase
        .from('tpl_tasks')
        .insert(tasksToInsert)

      if (tasksError) {
        return NextResponse.json(
          { error: `Erro ao criar tarefas: ${tasksError.message}` },
          { status: 500 }
        )
      }

      // Inserir subtarefas (3º nível)
      // Cast para aceder a tpl_subtasks (tabela não presente no database.ts gerado)
      const db = supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> }

      const { data: insertedTasks } = await supabase
        .from('tpl_tasks')
        .select('id, order_index')
        .eq('tpl_stage_id', insertedStage.id)
        .order('order_index')

      if (insertedTasks) {
        for (let i = 0; i < stage.tasks.length; i++) {
          const task = stage.tasks[i] as Record<string, unknown>
          const subtasks = task.subtasks as Array<Record<string, unknown>> | undefined
          if (subtasks && subtasks.length > 0 && insertedTasks[i]) {
            const subtasksToInsert = subtasks.map((st, idx) => ({
              tpl_task_id: insertedTasks[i].id,
              title: st.title,
              description: st.description || null,
              is_mandatory: st.is_mandatory,
              order_index: idx,
              config: {
                type: st.type,
                ...(st.config as Record<string, unknown> || {}),
              },
            }))

            const { error: subtasksError } = await (db.from('tpl_subtasks') as ReturnType<typeof supabase.from>)
              .insert(subtasksToInsert)

            if (subtasksError) {
              return NextResponse.json(
                { error: `Erro ao criar subtarefas: ${subtasksError.message}` },
                { status: 500 }
              )
            }
          }
        }
      }
    }

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — Soft delete (is_active = false)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('tpl_processes')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deactivating template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
