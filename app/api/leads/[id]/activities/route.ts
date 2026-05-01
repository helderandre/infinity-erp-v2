// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createActivitySchema } from '@/lib/validations/leads-crm'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const negocioId = searchParams.get('negocio_id')
    const supabase = await createClient()

    // CRM activities (leads_activities — current system) — joined with the
    // negocio so the timeline can badge "Negócio: <ref>" when applicable.
    let crmQuery = supabase
      .from('leads_activities')
      .select(`
        *,
        created_by_user:dev_users!created_by(id, commercial_name),
        negocio:negocios(id, tipo, estado, localizacao, preco_venda, orcamento_max, renda_pretendida, renda_max_mensal)
      `)
      .eq('contact_id', id)
      .limit(200)

    if (negocioId) crmQuery = crmQuery.eq('negocio_id', negocioId)

    const { data: crmActivities } = await crmQuery

    // Legacy lead_activities (kept for backwards compat — pre-CRM rows)
    const { data: oldActivities } = await supabase
      .from('lead_activities')
      .select('*, agent:dev_users!agent_id(id, commercial_name)')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(100)

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

    // Merge and sort by effective date — pinned items always surface first
    const all = [...(crmActivities || []), ...normalizedOld]
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
        const ad = a.occurred_at || a.created_at
        const bd = b.occurred_at || b.created_at
        return new Date(bd).getTime() - new Date(ad).getTime()
      })
      .slice(0, 200)

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
        negocio:negocios(id, tipo, estado, localizacao, preco_venda, orcamento_max, renda_pretendida, renda_max_mensal)
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
