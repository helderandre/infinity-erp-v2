import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    // Obter tarefas agrupadas por fase
    const { data: tasks, error: tasksError } = await supabase
      .from('proc_tasks')
      .select(
        `
        *,
        assigned_to_user:dev_users!proc_tasks_assigned_to_fkey(id, commercial_name)
      `
      )
      .eq('proc_instance_id', id)
      .order('stage_order_index', { ascending: true })
      .order('order_index', { ascending: true })

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
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
