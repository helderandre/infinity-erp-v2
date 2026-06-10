// @ts-nocheck
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

/**
 * GET /api/parceiros/oportunidades/[id]
 *
 * Vista read-only do parceiro sobre uma oportunidade que ele referenciou.
 * O role "Parceiro" não tem permissões de módulo (permissions = {}), por isso
 * os endpoints normais do CRM (`/api/negocios/[id]`, `/api/visits`,
 * `/api/negocios/[id]/proposals`, `/api/deals`) devolvem 403/404 ou listas
 * vazias para ele. Este endpoint faz UMA leitura bundled via admin client,
 * gated estritamente por `negocios.referrer_consultant_id = auth.user.id`
 * (ou gestão), e devolve tudo o que o sheet do parceiro precisa:
 *
 *   { negocio, visits, proposals, deals, activities }
 *
 * `activities` é o histórico cronológico unificado (mesma forma do
 * GET /api/leads/[id]/activities) — leads_activities + tarefas + eventos de
 * calendário + lead_activities legacy + visitas — para o parceiro ver tudo o
 * que o consultor fez (chamadas, visitas agendadas, notas, mudanças de fase).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createCrmAdminClient()

    const { data: negocio, error } = await admin
      .from('negocios')
      .select(`
        *,
        pipeline_stage:leads_pipeline_stages!pipeline_stage_id(id, name, color, order_index, is_terminal, terminal_type, sla_days, pipeline_type),
        lead:leads!negocios_lead_id_fkey(id, nome, full_name, telefone, telemovel, email, tem_empresa, empresa, nipc),
        consultant:dev_users!assigned_consultant_id(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url)),
        referrer:dev_users!negocios_referrer_consultant_id_fkey(id, commercial_name),
        entry:leads_entries!negocios_entry_id_fkey(id, source, form_data, form_url, notes, property_external_ref, created_at, utm_source, utm_medium, utm_campaign, utm_content),
        origin_property:dev_properties!negocios_property_id_fkey(id, title, external_ref, city, slug, listing_price)
      `)
      .eq('id', id)
      .single()

    if (error || !negocio) {
      return NextResponse.json({ error: 'Oportunidade não encontrada' }, { status: 404 })
    }

    // Gate: só o referrer desta oportunidade (ou gestão). 404 para não
    // revelar existência.
    const isReferrer = negocio.referrer_consultant_id === auth.user.id
    if (!isReferrer && !isManagementRole(auth.roles)) {
      return NextResponse.json({ error: 'Oportunidade não encontrada' }, { status: 404 })
    }

    const leadId = negocio.lead_id as string | null

    const visitsPromise = leadId
      ? admin
          .from('visits')
          .select(`
            *,
            property:dev_properties!property_id(id, title, external_ref, city, zone, address_street, slug),
            consultant:dev_users!consultant_id(id, commercial_name)
          `)
          .eq('lead_id', leadId)
          .order('visit_date', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] })

    const proposalsPromise = admin
      .from('negocio_proposals')
      .select(`
        *,
        property:dev_properties!property_id(id, title, slug, listing_price, external_ref, city, zone),
        creator:dev_users!created_by(id, commercial_name)
      `)
      .eq('negocio_id', id)
      .order('created_at', { ascending: false })

    const dealsPromise = admin
      .from('deals')
      .select(`
        id, status, deal_value, deal_date, created_at,
        property:dev_properties(id, title, external_ref, city, listing_price),
        consultant:dev_users!deals_consultant_id_fkey(id, commercial_name)
      `)
      .eq('negocio_id', id)
      .order('created_at', { ascending: false })

    // ── Histórico unificado (mesma normalização do /api/leads/[id]/activities) ──
    // leads_activities ficam scoped à oportunidade referenciada (ou sem
    // negócio) para não vazar notas de OUTRAS oportunidades do mesmo contacto.
    const crmActivitiesPromise = leadId
      ? admin
          .from('leads_activities')
          .select('*, created_by_user:dev_users!created_by(id, commercial_name)')
          .eq('contact_id', leadId)
          .or(`negocio_id.eq.${id},negocio_id.is.null`)
          .limit(200)
      : Promise.resolve({ data: [] })

    const tasksPromise = leadId
      ? admin
          .from('tasks')
          .select(`
            id, title, description, due_date, priority,
            is_completed, completed_at, created_by, created_at, assigned_to,
            assigned_user:dev_users!assigned_to(id, commercial_name),
            created_by_user:dev_users!created_by(id, commercial_name)
          `)
          .eq('entity_type', 'lead')
          .eq('entity_id', leadId)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] })

    const eventsPromise = leadId
      ? admin
          .from('calendar_events')
          .select(`
            id, title, description, start_date, end_date, all_day,
            category, item_type, location, created_by, created_at,
            created_by_user:dev_users!created_by(id, commercial_name)
          `)
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] })

    const oldPromise = leadId
      ? admin
          .from('lead_activities')
          .select('*, agent:dev_users!agent_id(id, commercial_name)')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] })

    const [
      { data: visits },
      { data: proposals },
      { data: deals },
      { data: crmActivities },
      { data: tasksRows },
      { data: eventsRows },
      { data: oldActivities },
    ] = await Promise.all([
      visitsPromise,
      proposalsPromise,
      dealsPromise,
      crmActivitiesPromise,
      tasksPromise,
      eventsPromise,
      oldPromise,
    ])

    const normalizedOld = (oldActivities || []).map((a) => ({
      id: a.id,
      contact_id: a.lead_id,
      negocio_id: null,
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
      contact_id: leadId,
      negocio_id: null,
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
      contact_id: leadId,
      negocio_id: null,
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

    // Visitas entram no histórico como itens próprios — "agendou visita a X".
    const normalizedVisits = (visits || []).map((v) => ({
      id: `visit:${v.id}`,
      contact_id: leadId,
      negocio_id: null,
      activity_type: 'visit',
      direction: null,
      subject: v.property?.title ? `Visita — ${v.property.title}` : 'Visita',
      description: [
        v.property?.city ? `${v.property.city}${v.property.zone ? `, ${v.property.zone}` : ''}` : null,
        v.status ? `Estado: ${v.status}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
      metadata: { source_type: 'visit', source_id: v.id, status: v.status },
      created_by: v.consultant?.id ?? null,
      created_at: v.created_at,
      occurred_at: v.visit_date
        ? `${String(v.visit_date).slice(0, 10)}T${v.visit_time || '00:00:00'}`
        : null,
      is_pinned: false,
      created_by_user: v.consultant ?? null,
    }))

    const activities = [
      ...(crmActivities || []),
      ...normalizedTasks,
      ...normalizedEvents,
      ...normalizedVisits,
      ...normalizedOld,
    ]
      .sort((a, b) => {
        const ad = a.occurred_at || a.created_at
        const bd = b.occurred_at || b.created_at
        return new Date(bd).getTime() - new Date(ad).getTime()
      })
      .slice(0, 300)

    return NextResponse.json({
      negocio,
      visits: visits || [],
      proposals: proposals || [],
      deals: deals || [],
      activities,
    })
  } catch (err) {
    console.error('[parceiros/oportunidades/[id] GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
