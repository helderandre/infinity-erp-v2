import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET: Retorna as tarefas do template relevantes para um proprietário,
 * filtrando por owner_scope e person_type.
 * Usado pelo dropdown de selecção de tarefas por proprietário.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params
    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('owner_id')

    if (!UUID_REGEX.test(processId)) {
      return NextResponse.json({ error: 'processId inválido' }, { status: 400 })
    }
    if (!ownerId || !UUID_REGEX.test(ownerId)) {
      return NextResponse.json({ error: 'owner_id inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // 1. Buscar processo
    const { data: proc } = await supabase
      .from('proc_instances')
      .select('id, tpl_process_id, property_id')
      .eq('id', processId)
      .single()

    if (!proc?.tpl_process_id) {
      return NextResponse.json({ error: 'Processo sem template' }, { status: 400 })
    }

    // 2. Buscar owner
    const { data: owner } = await supabase
      .from('owners')
      .select('id, name, person_type')
      .eq('id', ownerId)
      .single()

    if (!owner) {
      return NextResponse.json({ error: 'Proprietário não encontrado' }, { status: 404 })
    }

    // 3. Buscar junction para is_main_contact
    const { data: junction } = await supabase
      .from('property_owners')
      .select('is_main_contact')
      .eq('property_id', proc.property_id)
      .eq('owner_id', ownerId)
      .single()

    const isMainContact = junction?.is_main_contact ?? false
    const ownerType = owner.person_type

    // 4. Buscar tarefas do template com subtarefas
    const { data: tplTasks } = await adminSupabase
      .from('tpl_tasks')
      .select(`
        id, title, config, order_index,
        tpl_stage:tpl_stages!inner(name, order_index, tpl_process_id),
        tpl_subtasks:tpl_subtasks!tpl_subtasks_tpl_task_id_fkey(
          id, title, config, order_index
        )
      `)
      .eq('tpl_stage.tpl_process_id', proc.tpl_process_id)
      .order('order_index')

    if (!tplTasks) {
      return NextResponse.json({ tasks: [] })
    }

    // 5. Filtrar: apenas tarefas que tenham subtarefas com owner_scope relevante
    const result = []

    for (const task of tplTasks) {
      const taskConfig = (task.config || {}) as Record<string, unknown>
      const taskOwnerType = taskConfig.owner_type as string | undefined

      // Se task tem owner_type e não corresponde, ignorar
      if (taskOwnerType && taskOwnerType !== ownerType) continue

      const subtasks = ((task.tpl_subtasks as any[]) || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)

      // Filtrar subtasks relevantes para este owner
      const relevantSubtasks = subtasks.filter((st: any) => {
        const stConfig = (st.config || {}) as Record<string, unknown>
        const ownerScope = stConfig.owner_scope as string | undefined
        const personTypeFilter = stConfig.person_type_filter as string | undefined

        // Sem owner_scope ou 'none' → não é per-owner
        if (!ownerScope || ownerScope === 'none') return false

        // Filtro main_contact
        if (ownerScope === 'main_contact_only' && !isMainContact) return false

        // Filtro person_type
        if (personTypeFilter && personTypeFilter !== 'all' && personTypeFilter !== ownerType) return false

        return true
      })

      if (relevantSubtasks.length === 0) continue

      const stage = task.tpl_stage as any
      result.push({
        id: task.id,
        title: task.title,
        config: task.config,
        stage_name: stage.name,
        tpl_subtasks: relevantSubtasks.map((st: any) => ({
          id: st.id,
          title: st.title,
          config: st.config,
          order_index: st.order_index,
        })),
      })
    }

    return NextResponse.json({ tasks: result })
  } catch (error) {
    console.error('Erro ao buscar template tasks:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
