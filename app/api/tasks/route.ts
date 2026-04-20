import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createTaskSchema, taskQuerySchema } from '@/lib/validations/task'
import { notificationService } from '@/lib/notifications/service'

// ─── Priority mapping (proc_tasks usa string, tasks usa 1-4) ───
const PROC_PRIORITY_TO_NUM: Record<string, number> = {
  urgent: 1,
  high: 2,
  normal: 3,
  medium: 3,
  low: 4,
}
const NUM_PRIORITY_TO_PROC: Record<number, string[]> = {
  1: ['urgent'],
  2: ['high'],
  3: ['normal', 'medium'],
  4: ['low'],
}

function mapProcPriority(p: string | null | undefined): number {
  if (!p) return 3
  return PROC_PRIORITY_TO_NUM[p] ?? 3
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const params = taskQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!params.success) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const {
      assigned_to, created_by, priority, is_completed, overdue,
      entity_type, entity_id, parent_task_id, search,
      source_filter, task_list_id,
      limit, offset,
    } = params.data

    const supabase = createAdminClient()

    // ─── Sub-task drill-down: only general tasks table (proc subtasks not nested) ───
    if (parent_task_id) {
      const { data, error, count } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:assigned_to(id, commercial_name),
          creator:created_by(id, commercial_name)
        `, { count: 'exact' })
        .eq('parent_task_id', parent_task_id)
        .order('order_index', { ascending: true })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('Erro ao listar sub-tarefas:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ data: data || [], total: count || 0 })
    }

    const now = new Date().toISOString()

    // Source flags consoante o filter:
    // - 'personal' = tasks (todoist-style) + visit_proposal,  SEM proc tasks
    // - 'process'  = só proc_task + proc_subtask, SEM tasks gerais nem visit proposals
    // - undefined  = tudo (back-compat)
    // When filtering by a task list, proc tasks and visit proposals don't apply
    // (they aren't assignable to lists).
    const listScoped = !!task_list_id
    const includeGeneralTasks = source_filter !== 'process'
    const includeProcSourcesByFilter = !listScoped && source_filter !== 'personal'
    const includeVisitProposals = !listScoped && source_filter !== 'process'

    // ─── 1. General tasks query ───
    let tasksQuery = supabase
      .from('tasks')
      .select(`
        *,
        assignee:assigned_to(id, commercial_name),
        creator:created_by(id, commercial_name),
        sub_tasks:tasks!parent_task_id(id, title, is_completed, priority, due_date, assigned_to, order_index)
      `)
      .is('parent_task_id', null)

    if (assigned_to) tasksQuery = tasksQuery.eq('assigned_to', assigned_to)
    if (created_by) tasksQuery = tasksQuery.eq('created_by', created_by)
    if (priority) tasksQuery = tasksQuery.eq('priority', priority)
    if (is_completed === 'true') tasksQuery = tasksQuery.eq('is_completed', true)
    if (is_completed === 'false') tasksQuery = tasksQuery.eq('is_completed', false)
    if (overdue === 'true') {
      tasksQuery = tasksQuery.eq('is_completed', false).lt('due_date', now)
    }
    if (entity_type) tasksQuery = tasksQuery.eq('entity_type', entity_type)
    if (entity_id) tasksQuery = tasksQuery.eq('entity_id', entity_id)
    if (task_list_id) tasksQuery = tasksQuery.eq('task_list_id', task_list_id)
    if (search) tasksQuery = tasksQuery.ilike('title', `%${search}%`)

    // ─── Decide if proc sources are eligible (entity_type filter + source_filter) ───
    // Proc tasks/subtasks are intrinsically tied to a 'process' entity.
    const includeProcSources =
      includeProcSourcesByFilter && (!entity_type || entity_type === 'process')

    // ─── 2. Process tasks query ───
    let procTasksPromise: Promise<{ data: any[] | null }> = Promise.resolve({ data: [] })
    if (includeProcSources) {
      let q = supabase
        .from('proc_tasks')
        .select(`
          id, title, due_date, status, priority, assigned_to, stage_name,
          stage_order_index, order_index, completed_at, created_at, proc_instance_id,
          proc_instances!inner(id, external_ref, current_status, deleted_at, property_id, process_type, negocio_id,
            dev_properties(id, title)
          ),
          assignee:dev_users!proc_tasks_assigned_to_fkey(id, commercial_name)
        `)
        .is('proc_instances.deleted_at', null)
        .in('proc_instances.current_status', ['active', 'on_hold'])

      if (assigned_to) q = q.eq('assigned_to', assigned_to)
      if (priority && NUM_PRIORITY_TO_PROC[priority]) {
        q = q.in('priority', NUM_PRIORITY_TO_PROC[priority])
      }
      if (is_completed === 'true') {
        q = q.in('status', ['completed', 'skipped'])
      } else if (is_completed === 'false') {
        q = q.not('status', 'in', '("completed","skipped")')
      }
      if (overdue === 'true') {
        q = q.not('status', 'in', '("completed","skipped")').not('due_date', 'is', null).lt('due_date', now)
      }
      if (entity_id) q = q.eq('proc_instance_id', entity_id)
      if (search) q = q.ilike('title', `%${search}%`)

      procTasksPromise = q as any
    }

    // ─── 3. Process subtasks query ───
    let procSubtasksPromise: Promise<{ data: any[] | null }> = Promise.resolve({ data: [] })
    if (includeProcSources) {
      let q = supabase
        .from('proc_subtasks')
        .select(`
          id, title, due_date, is_completed, priority, assigned_to,
          completed_at, created_at, proc_task_id,
          proc_tasks!inner(id, title, stage_name, stage_order_index, proc_instance_id,
            proc_instances!inner(id, external_ref, current_status, deleted_at, property_id, process_type, negocio_id,
              dev_properties(id, title)
            )
          ),
          assignee:dev_users!proc_subtasks_assigned_to_fkey(id, commercial_name),
          owners(id, name)
        `)
        .is('proc_tasks.proc_instances.deleted_at', null)
        .in('proc_tasks.proc_instances.current_status', ['active', 'on_hold'])

      if (assigned_to) q = q.eq('assigned_to', assigned_to)
      if (priority && NUM_PRIORITY_TO_PROC[priority]) {
        q = q.in('priority', NUM_PRIORITY_TO_PROC[priority])
      }
      if (is_completed === 'true') q = q.eq('is_completed', true)
      if (is_completed === 'false') q = q.eq('is_completed', false)
      if (overdue === 'true') {
        q = q.eq('is_completed', false).not('due_date', 'is', null).lt('due_date', now)
      }
      if (entity_id) q = q.eq('proc_tasks.proc_instance_id', entity_id)
      if (search) q = q.ilike('title', `%${search}%`)

      procSubtasksPromise = q as any
    }

    // ─── 4. Visit proposals (cross-agent visits requiring seller agent action) ───
    // Aparecem como tasks no inbox do seller agent (current user é o seller).
    //
    // - is_completed='false' (default): só propostas PENDENTES (status='proposal')
    //   → renderizadas como cards de acção com botões Confirmar/Rejeitar
    // - is_completed='true': propostas RESPONDIDAS (proposal_responded_at IS NOT NULL,
    //   status agora é 'scheduled' ou 'rejected')
    //   → renderizadas como linhas normais de task concluída, com a decisão visível
    //
    // Visitas que ficaram em 'cancelled'/'no_show' depois de terem sido confirmadas
    // continuam a aparecer aqui — a acção de responder à proposta continua válida.
    let visitProposalsPromise: Promise<{ data: any[] | null }> = Promise.resolve({ data: [] })
    if (includeVisitProposals) {
      let q = supabase
        .from('visits')
        .select(`
          id, visit_date, visit_time, duration_minutes, status, notes,
          consultant_id, seller_consultant_id, lead_id, property_id, client_name,
          created_at,
          proposal_responded_at, rejected_reason,
          buyer_agent:dev_users!visits_consultant_id_fkey(id, commercial_name),
          lead:leads!visits_lead_id_fkey(id, nome),
          property:dev_properties!visits_property_id_fkey(id, title)
        `)
        .eq('seller_consultant_id', auth.user.id)

      if (is_completed === 'true') {
        // Histórico de propostas respondidas
        q = q.not('proposal_responded_at', 'is', null)
      } else {
        // Pendentes (default)
        q = q.eq('status', 'proposal')
      }

      if (search) q = q.ilike('client_name', `%${search}%`)
      visitProposalsPromise = q as any
    }

    const [tasksRes, procTasksRes, procSubtasksRes, visitProposalsRes] = await Promise.all([
      tasksQuery,
      procTasksPromise,
      procSubtasksPromise,
      visitProposalsPromise,
    ])

    if ((tasksRes as any).error) {
      console.error('Erro ao listar tarefas:', (tasksRes as any).error)
      return NextResponse.json({ error: (tasksRes as any).error.message }, { status: 500 })
    }

    // ─── Normalize ───
    const tasks: any[] = includeGeneralTasks
      ? (tasksRes.data || []).map((t: any) => ({ ...t, source: 'task' }))
      : []

    const procTasks: any[] = (procTasksRes.data || []).map((pt: any) => {
      const proc = pt.proc_instances
      const property = proc?.dev_properties
      return {
        id: `proc_task:${pt.id}`,
        title: pt.title,
        description: pt.stage_name || null,
        parent_task_id: null,
        assigned_to: pt.assigned_to,
        created_by: null,
        priority: mapProcPriority(pt.priority),
        due_date: pt.due_date,
        is_recurring: false,
        recurrence_rule: null,
        is_completed: pt.status === 'completed' || pt.status === 'skipped',
        completed_at: pt.completed_at,
        completed_by: null,
        entity_type: 'process',
        entity_id: pt.proc_instance_id,
        order_index: pt.order_index || 0,
        created_at: pt.created_at,
        updated_at: pt.created_at,
        assignee: pt.assignee || null,
        creator: null,
        sub_tasks: [],
        source: 'proc_task',
        process_id: proc?.id || null,
        process_ref: proc?.external_ref || null,
        process_type: proc?.process_type || null,
        negocio_id: proc?.negocio_id || null,
        stage_name: pt.stage_name || null,
        property_id: property?.id || null,
        property_title: property?.title || null,
      }
    })

    const procSubtasks: any[] = (procSubtasksRes.data || []).map((sub: any) => {
      const parent = sub.proc_tasks
      const proc = parent?.proc_instances
      const property = proc?.dev_properties
      const owner = sub.owners
      return {
        id: `proc_subtask:${sub.id}`,
        title: owner ? `${sub.title} (${owner.name})` : sub.title,
        description: parent ? `${parent.stage_name || ''} · ${parent.title}` : null,
        parent_task_id: null,
        assigned_to: sub.assigned_to,
        created_by: null,
        priority: mapProcPriority(sub.priority),
        due_date: sub.due_date,
        is_recurring: false,
        recurrence_rule: null,
        is_completed: !!sub.is_completed,
        completed_at: sub.completed_at,
        completed_by: null,
        entity_type: 'process',
        entity_id: parent?.proc_instance_id || null,
        order_index: 0,
        created_at: sub.created_at,
        updated_at: sub.created_at,
        assignee: sub.assignee || null,
        creator: null,
        sub_tasks: [],
        source: 'proc_subtask',
        process_id: proc?.id || null,
        process_ref: proc?.external_ref || null,
        process_type: proc?.process_type || null,
        negocio_id: proc?.negocio_id || null,
        stage_name: parent?.stage_name || null,
        property_id: property?.id || null,
        property_title: property?.title || null,
      }
    })

    // ─── Visit proposals → task-like shape ───
    const visitProposals: any[] = (visitProposalsRes.data || []).map((v: any) => {
      const property = v.property
      const buyerAgent = v.buyer_agent
      const lead = v.lead
      const clientName = lead?.nome ?? v.client_name ?? 'Cliente'
      const propertyTitle = property?.title ?? 'Imóvel'
      const startISO = `${v.visit_date}T${v.visit_time}`

      // Status do "task" — confirmar/rejeitar é o trabalho. Quando há
      // proposal_responded_at, o trabalho está feito; o status final da visita
      // diz se foi confirmado ou rejeitado.
      const isResponded = !!v.proposal_responded_at
      const wasRejected = v.status === 'rejected'

      let title: string
      if (!isResponded) {
        title = `Confirmar visita: ${propertyTitle}`
      } else if (wasRejected) {
        title = `Proposta rejeitada: ${propertyTitle}`
      } else {
        title = `Visita confirmada: ${propertyTitle}`
      }

      let description: string | null
      if (!isResponded) {
        description = `${clientName}${buyerAgent ? ` · proposta por ${buyerAgent.commercial_name}` : ''}`
      } else if (wasRejected && v.rejected_reason) {
        description = `${clientName} · Motivo: ${v.rejected_reason}`
      } else {
        description = `${clientName}${buyerAgent ? ` · proposta por ${buyerAgent.commercial_name}` : ''}`
      }

      return {
        id: `visit_proposal:${v.id}`,
        title,
        description,
        parent_task_id: null,
        assigned_to: v.seller_consultant_id,
        created_by: v.consultant_id,
        // Visitas propostas têm prioridade alta — são bloqueantes para o outro agente
        priority: 2,
        due_date: startISO,
        is_recurring: false,
        recurrence_rule: null,
        is_completed: isResponded,
        completed_at: v.proposal_responded_at,
        completed_by: null,
        entity_type: 'property' as const,
        entity_id: v.property_id,
        order_index: 0,
        created_at: v.created_at,
        updated_at: v.proposal_responded_at || v.created_at,
        assignee: null,
        creator: buyerAgent || null,
        sub_tasks: [],
        source: 'visit_proposal',
        property_id: property?.id || null,
        property_title: propertyTitle,
        // Campos específicos da visita
        visit_id: v.id,
        visit_buyer_agent_name: buyerAgent?.commercial_name ?? null,
        visit_client_name: clientName,
      }
    })

    // ─── Merge + sort + paginate ───
    const merged = [...tasks, ...visitProposals, ...procTasks, ...procSubtasks]
    merged.sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
      if (a.priority !== b.priority) return (a.priority || 99) - (b.priority || 99)
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity
      return aDue - bDue
    })

    const total = merged.length
    const paginated = merged.slice(offset, offset + limit)

    return NextResponse.json({ data: paginated, total })
  } catch (error) {
    console.error('Erro ao listar tarefas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const validation = createTaskSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data
    const supabase = createAdminClient()

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title: data.title,
        description: data.description || null,
        parent_task_id: data.parent_task_id || null,
        assigned_to: data.assigned_to || null,
        created_by: auth.user.id,
        priority: data.priority,
        due_date: data.due_date || null,
        is_recurring: data.is_recurring,
        recurrence_rule: data.recurrence_rule || null,
        entity_type: data.entity_type || null,
        entity_id: data.entity_id || null,
        task_list_id: data.task_list_id || null,
        section: data.section || null,
      })
      .select('id, title, assigned_to')
      .single()

    if (error) {
      console.error('Erro ao criar tarefa:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notify assignee if different from creator
    if (task.assigned_to && task.assigned_to !== auth.user.id) {
      await notificationService.create({
        recipientId: task.assigned_to,
        senderId: auth.user.id,
        notificationType: 'task_assigned',
        entityType: 'proc_task', // Reuse existing entity type
        entityId: task.id,
        title: 'Nova tarefa atribuída',
        body: task.title,
        actionUrl: `/dashboard/tarefas?task=${task.id}`,
      })
    }

    return NextResponse.json({ id: task.id }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar tarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
