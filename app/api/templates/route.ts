import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { templateSchema } from '@/lib/validations/template'

export async function GET() {
  try {
    const supabase = await createClient()

    // Buscar templates com contagem de stages e tasks
    const { data: templates, error } = await supabase
      .from('tpl_processes')
      .select(`
        id,
        name,
        description,
        is_active,
        created_at,
        tpl_stages (
          id,
          tpl_tasks (id)
        )
      `)
      .order('created_at', { ascending: false })

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

    const { name, description, stages } = parsed.data

    // 2. Inserir tpl_processes
    const { data: process, error: processError } = await supabase
      .from('tpl_processes')
      .insert({ name, description })
      .select('id')
      .single()

    if (processError || !process) {
      return NextResponse.json(
        { error: processError?.message || 'Erro ao criar template' },
        { status: 500 }
      )
    }

    // 3. Inserir tpl_stages + tpl_tasks para cada fase
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
        // Rollback manual: apagar o processo criado
        await supabase.from('tpl_processes').delete().eq('id', process.id)
        return NextResponse.json(
          { error: `Erro ao criar fase "${stage.name}": ${stageError?.message}` },
          { status: 500 }
        )
      }

      // 4. Inserir tarefas da fase
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
        // Rollback manual
        await supabase.from('tpl_processes').delete().eq('id', process.id)
        return NextResponse.json(
          { error: `Erro ao criar tarefas: ${tasksError.message}` },
          { status: 500 }
        )
      }

      // 5. Inserir subtarefas (3º nível)
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
              await supabase.from('tpl_processes').delete().eq('id', process.id)
              return NextResponse.json(
                { error: `Erro ao criar subtarefas: ${subtasksError.message}` },
                { status: 500 }
              )
            }
          }
        }
      }
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
