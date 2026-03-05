import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ACTION_TYPE_LABELS } from '@/lib/constants'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Get process instance to find property_id
    const { data: instance } = await supabase
      .from('proc_instances')
      .select('id, property_id')
      .eq('id', processId)
      .single()

    if (!instance) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    // Fetch tasks with subtasks
    const { data: tasks } = await supabase
      .from('proc_tasks')
      .select(`
        id, title, action_type, status, stage_name,
        subtasks:proc_subtasks(id, title, is_completed, config, owner_id, owner:owners!proc_subtasks_owner_id_fkey(name))
      `)
      .eq('proc_instance_id', processId)
      .order('stage_order_index', { ascending: true })
      .order('order_index', { ascending: true })

    // Fetch documents if property exists
    let docs: { id: string; file_name: string; status: string; doc_type: { name: string } | null }[] = []
    if (instance.property_id) {
      const { data: docData } = await supabase
        .from('doc_registry')
        .select('id, file_name, status, doc_type:doc_types(name)')
        .eq('property_id', instance.property_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      docs = (docData || []) as typeof docs
    }

    // Build entities list
    type Entity = {
      id: string
      display: string
      type: 'task' | 'subtask' | 'doc'
      status: string
      extra?: string
      config_type?: string
      owner_name?: string
      action_type?: string
    }
    const entities: Entity[] = []

    // Tasks
    for (const task of (tasks || [])) {
      const t = task as {
        id: string; title: string; action_type: string; status: string; stage_name: string
        subtasks?: { id: string; title: string; is_completed: boolean; config: { type?: string }; owner_id?: string; owner?: { name: string } | null }[]
      }
      const actionLabel = ACTION_TYPE_LABELS[t.action_type as keyof typeof ACTION_TYPE_LABELS] || t.action_type
      entities.push({
        id: `task:${t.id}`,
        display: `${t.title} (${actionLabel})`,
        type: 'task',
        status: t.status,
        extra: t.stage_name,
        action_type: t.action_type,
      })

      // Subtasks
      if (t.subtasks) {
        for (const st of t.subtasks) {
          const ownerSuffix = st.owner?.name ? ` — ${st.owner.name}` : ''
          entities.push({
            id: `subtask:${st.id}`,
            display: `${st.title}${ownerSuffix}`,
            type: 'subtask',
            status: st.is_completed ? 'completed' : 'pending',
            extra: t.title,
            config_type: st.config?.type || 'checklist',
            owner_name: st.owner?.name,
          })
        }
      }
    }

    // Documents
    for (const doc of docs) {
      const d = doc as { id: string; file_name: string; status: string; doc_type: { name: string } | null }
      const typeName = d.doc_type?.name ? ` (${d.doc_type.name})` : ''
      entities.push({
        id: `doc:${d.id}`,
        display: `${d.file_name}${typeName}`,
        type: 'doc',
        status: d.status,
      })
    }

    return NextResponse.json({ entities })
  } catch (error) {
    console.error('Error fetching chat entities:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
