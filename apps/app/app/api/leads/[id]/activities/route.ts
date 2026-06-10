// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createActivitySchema } from '@/lib/validations/leads-crm'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const negocioId = searchParams.get('negocio_id')
    const supabase = await createClient()

    // Scope: gestão e quem tem o módulo `leads` mantêm o acesso actual;
    // um referrer (ex.: parceiro externo, sem permissões de módulo) só lê o
    // histórico de leads onde é referrer de pelo menos um negócio.
    if (!isManagementRole(auth.roles) && auth.permissions.leads !== true) {
      const { data: refRow } = await supabase
        .from('negocios')
        .select('id')
        .eq('lead_id', id)
        .eq('referrer_consultant_id', auth.user.id)
        .limit(1)
        .maybeSingle()
      if (!refRow) {
        return NextResponse.json({ error: 'Sem acesso' }, { status: 403 })
      }
    }

    // CRM activities (leads_activities — current system) — joined with the
    // negocio so the timeline can badge "Negócio: <ref>" when applicable.
    let crmQuery = supabase
      .from('leads_activities')
      .select(`
        *,
        created_by_user:dev_users!created_by(id, commercial_name),
        negocio:negocios(id, tipo, business_type, tipo_imovel, quartos, quartos_min, estado, localizacao, preco_venda, orcamento_max, renda_pretendida, renda_max_mensal)
      `)
      .eq('contact_id', id)
      .limit(200)

    if (negocioId) crmQuery = crmQuery.eq('negocio_id', negocioId)

    // Tasks linked to this lead (entity_type='lead', entity_id=$id) — surfaced
    // as synthetic activities so the histórico shows the full chronological
    // record of what was created against this contact.
    // Skipped when scoped to a specific negocio (tasks here are lead-level).
    const tasksPromise = negocioId
      ? Promise.resolve({ data: [] as any[] })
      : supabase
          .from('tasks')
          .select(`
            id, title, description, due_date, priority,
            is_completed, completed_at, created_by, created_at,
            assigned_to,
            assigned_user:dev_users!assigned_to(id, commercial_name),
            created_by_user:dev_users!created_by(id, commercial_name)
          `)
          .eq('entity_type', 'lead')
          .eq('entity_id', id)
          .order('created_at', { ascending: false })
          .limit(100)

    // Calendar events linked to this lead (lead_id=$id).
    const eventsPromise = negocioId
      ? Promise.resolve({ data: [] as any[] })
      : supabase
          .from('calendar_events')
          .select(`
            id, title, description, start_date, end_date, all_day,
            category, item_type, location, created_by, created_at,
            created_by_user:dev_users!created_by(id, commercial_name)
          `)
          .eq('lead_id', id)
          .order('created_at', { ascending: false })
          .limit(100)

    // Legacy lead_activities (kept for backwards compat — pre-CRM rows)
    const oldPromise = supabase
      .from('lead_activities')
      .select('*, agent:dev_users!agent_id(id, commercial_name)')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(100)

    const [
      { data: crmActivities },
      { data: tasksRows },
      { data: eventsRows },
      { data: oldActivities },
    ] = await Promise.all([crmQuery, tasksPromise, eventsPromise, oldPromise])

    const normalizedOld = (oldActivities || []).map((a) => ({
      id: a.id,
      contact_id: a.lead_id,
      negocio_id: null,
      negocio: null,
      activity_type: a.activity_type,
      direction: a.metadata?.direction || null,
      subject: a.metadata?.outcome
        ? a.metadata.outcome === 'success'
          ? 'Chamada atendida'
          : 'Chamada não atendida'
        : null,
      description: a.description,
      metadata: a.metadata,
      created_by: a.agent_id,
      created_at: a.created_at,
      occurred_at: null,
      is_pinned: false,
      created_by_user: a.agent,
    }))

    const normalizedTasks = (tasksRows || []).map((t) => ({
      id: `task:${t.id}`,
      contact_id: id,
      negocio_id: null,
      negocio: null,
      activity_type: 'task',
      direction: null,
      subject: t.title,
      description: t.description,
      metadata: {
        source_type: 'task',
        source_id: t.id,
        due_date: t.due_date,
        is_completed: t.is_completed,
        completed_at: t.completed_at,
        priority: t.priority,
        assigned_to: t.assigned_to,
        assigned_user: t.assigned_user,
      },
      created_by: t.created_by,
      created_at: t.created_at,
      occurred_at: t.due_date,
      is_pinned: false,
      created_by_user: t.created_by_user,
    }))

    const normalizedEvents = (eventsRows || []).map((e) => ({
      id: `event:${e.id}`,
      contact_id: id,
      negocio_id: null,
      negocio: null,
      activity_type: 'event',
      direction: null,
      subject: e.title,
      description: e.description,
      metadata: {
        source_type: 'event',
        source_id: e.id,
        start_date: e.start_date,
        end_date: e.end_date,
        all_day: e.all_day,
        category: e.category,
        item_type: e.item_type,
        location: e.location,
      },
      created_by: e.created_by,
      created_at: e.created_at,
      occurred_at: e.start_date,
      is_pinned: false,
      created_by_user: e.created_by_user,
    }))

    // Merge and sort by effective date — pinned items always surface first
    const all = [
      ...(crmActivities || []),
      ...normalizedTasks,
      ...normalizedEvents,
      ...normalizedOld,
    ]
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
        const ad = a.occurred_at || a.created_at
        const bd = b.occurred_at || b.created_at
        return new Date(bd).getTime() - new Date(ad).getTime()
      })
      .slice(0, 300)

    return NextResponse.json({ data: all })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params
    const body = await request.json()

    const parsed = createActivitySchema.safeParse({ ...body, contact_id: contactId })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const insertRow = {
      ...parsed.data,
      created_by: user?.id ?? null,
    }

    const { data, error } = await supabase
      .from('leads_activities')
      .insert(insertRow)
      .select(`
        *,
        created_by_user:dev_users!created_by(id, commercial_name),
        negocio:negocios(id, tipo, business_type, tipo_imovel, quartos, quartos_min, estado, localizacao, preco_venda, orcamento_max, renda_pretendida, renda_max_mensal)
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
