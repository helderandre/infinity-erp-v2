import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar se o processo existe
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('id, current_status, property_id')
      .eq('id', id)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    const adminSupabase = createAdminClient()

    // Eliminar subtarefas das tarefas deste processo
    const { data: taskIds } = await adminSupabase
      .from('proc_tasks')
      .select('id')
      .eq('proc_instance_id', id)

    if (taskIds && taskIds.length > 0) {
      const ids = taskIds.map((t: { id: string }) => t.id)
      await (adminSupabase as any)
        .from('proc_subtasks')
        .delete()
        .in('proc_task_id', ids)
    }

    // Eliminar tarefas do processo
    await adminSupabase
      .from('proc_tasks')
      .delete()
      .eq('proc_instance_id', id)

    // Eliminar mensagens do chat do processo (se existir tabela)
    try {
      await (adminSupabase as any)
        .from('proc_chat_messages')
        .delete()
        .eq('proc_instance_id', id)
    } catch {
      // Ignorar se tabela não existir
    }

    // Eliminar o processo
    const { error: deleteError } = await adminSupabase
      .from('proc_instances')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Erro ao eliminar processo:', deleteError)
      return NextResponse.json(
        { error: 'Erro ao eliminar processo', details: deleteError.message },
        { status: 500 }
      )
    }

    // Reverter o status do imóvel se estava 'in_process'
    if (proc.property_id) {
      const { data: property } = await adminSupabase
        .from('dev_properties')
        .select('status')
        .eq('id', proc.property_id)
        .single()

      if (property?.status === 'in_process') {
        await adminSupabase
          .from('dev_properties')
          .update({ status: 'pending_approval' })
          .eq('id', proc.property_id)
      }
    }

    return NextResponse.json({ success: true, message: 'Processo eliminado com sucesso' })
  } catch (error) {
    console.error('Erro ao eliminar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('proc_instances')
      .select(
        `
        *,
        property:dev_properties(
          id,
          title,
          slug,
          city,
          listing_price,
          status,
          property_type
        ),
        requested_by_user:dev_users!proc_instances_requested_by_fkey(
          id,
          commercial_name
        ),
        approved_by_user:dev_users!proc_instances_approved_by_fkey(
          id,
          commercial_name
        ),
        returned_by_user:dev_users!proc_instances_returned_by_fkey(
          id,
          commercial_name
        ),
        rejected_by_user:dev_users!proc_instances_rejected_by_fkey(
          id,
          commercial_name
        )
      `
      )
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    // Obter tarefas agrupadas por fase (com subtarefas)
    const { data: tasks, error: tasksError } = await supabase
      .from('proc_tasks')
      .select(
        `
        *,
        assigned_to_user:dev_users!proc_tasks_assigned_to_fkey(id, commercial_name, dev_consultant_profiles(profile_photo_url)),
        owner:owners!proc_tasks_owner_id_fkey(id, name, person_type),
        subtasks:proc_subtasks(
          id, title, is_mandatory, is_completed,
          completed_at, completed_by, order_index, config
        )
      `
      )
      .eq('proc_instance_id', id)
      .order('stage_order_index', { ascending: true })
      .order('order_index', { ascending: true })

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    // Ordenar subtarefas e aplanar profile_photo_url
    if (tasks) {
      tasks.forEach((task: any) => {
        if (task.subtasks) {
          task.subtasks.sort((a: any, b: any) => a.order_index - b.order_index)
        }
        if (task.assigned_to_user?.dev_consultant_profiles) {
          task.assigned_to_user.profile_photo_url =
            task.assigned_to_user.dev_consultant_profiles.profile_photo_url ?? null
          delete task.assigned_to_user.dev_consultant_profiles
        }
      })
    }

    // Agrupar tarefas por fase
    const stagesMap = new Map<string, any>()

    tasks?.forEach((task) => {
      const stageName = task.stage_name || 'Sem Fase'
      if (!stagesMap.has(stageName)) {
        stagesMap.set(stageName, {
          name: stageName,
          order_index: task.stage_order_index || 0,
          tasks: [],
          tasks_completed: 0,
          tasks_total: 0,
        })
      }

      const stage = stagesMap.get(stageName)!
      stage.tasks.push(task)
      stage.tasks_total += 1

      if (task.status === 'completed' || task.status === 'skipped') {
        stage.tasks_completed += 1
      }
    })

    // Determinar status da fase
    const stages = Array.from(stagesMap.values()).map((stage) => {
      let status: 'completed' | 'in_progress' | 'pending' = 'pending'

      if (stage.tasks_completed === stage.tasks_total) {
        status = 'completed'
      } else if (stage.tasks_completed > 0) {
        status = 'in_progress'
      }

      return { ...stage, status }
    })

    // Obter proprietários
    const { data: owners, error: ownersError } = await supabase
      .from('property_owners')
      .select(
        `
        ownership_percentage,
        is_main_contact,
        owner:owners(
          id,
          name,
          nif,
          person_type
        )
      `
      )
      .eq('property_id', data.property?.id)

    // Obter documentos do imóvel
    const { data: documents, error: docsError } = await supabase
      .from('doc_registry')
      .select(
        `
        id,
        file_name,
        file_url,
        status,
        created_at,
        doc_type:doc_types(id, name, category)
      `
      )
      .eq('property_id', data.property?.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    // Formatar resposta
    const response = {
      instance: data,
      stages: stages.sort((a, b) => a.order_index - b.order_index),
      owners: owners?.map((po: any) => ({
        ...po.owner,
        ownership_percentage: po.ownership_percentage,
        is_main_contact: po.is_main_contact,
      })) || [],
      documents: documents || [],
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Erro ao obter processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
