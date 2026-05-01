import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updateLeadSchema } from '@/lib/validations/lead'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { redactLead, shouldRedactLead } from '@/lib/auth/redact-lead'
import type { Database } from '@/types/database'

type LeadUpdate = Database['public']['Tables']['leads']['Update']

// Devolve 404 vs 403 conforme se o lead existe e o caller não tem
// ownership. Mantém-se a UX do detalhe inalterada para gestão (vê tudo).
async function checkLeadAccess(
  supabase: any,
  id: string,
  authUserId: string,
  isManagement: boolean,
): Promise<{ ok: true; agentId: string | null } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase
    .from('leads')
    .select('agent_id')
    .eq('id', id)
    .maybeSingle()
  if (error) return { ok: false, status: 500, error: error.message }
  if (!data) return { ok: false, status: 404, error: 'Lead não encontrado' }
  if (!isManagement && data.agent_id !== authUserId) {
    return { ok: false, status: 403, error: 'Sem permissão para este contacto' }
  }
  return { ok: true, agentId: data.agent_id }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()
    const access = await checkLeadAccess(
      supabase as any,
      id,
      auth.user.id,
      isManagementRole(auth.roles),
    )
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { data, error } = await supabase
      .from('leads')
      .select('*, agent:dev_users!agent_id(id, commercial_name)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const row = data as Record<string, unknown>
    const payload = shouldRedactLead(
      auth.roles,
      row.agent_id as string | null | undefined,
      auth.user.id,
    )
      ? redactLead(row)
      : row

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Erro ao obter lead:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()
    const access = await checkLeadAccess(
      supabase as any,
      id,
      auth.user.id,
      isManagementRole(auth.roles),
    )
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await request.json()
    const validation = updateLeadSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Se body vazio, retornar sem update
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ id })
    }

    // Trim strings e converter strings vazias em null
    const updateData: LeadUpdate = {}
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue
      if (typeof value === 'string') {
        const trimmed = value.trim()
        ;(updateData as Record<string, unknown>)[key] = trimmed || null
      } else {
        ;(updateData as Record<string, unknown>)[key] = value
      }
    }

    const { error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao actualizar lead', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Erro ao actualizar lead:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()
    const access = await checkLeadAccess(
      supabase as any,
      id,
      auth.user.id,
      isManagementRole(auth.roles),
    )
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    // `calendar_events.lead_id` has FK ON DELETE NO ACTION — would block the
    // delete if any event references this lead. Decouple first by NULLing
    // the FK; the events themselves stay (they belong to the consultant's
    // calendar, not to the lead).
    await supabase
      .from('calendar_events')
      .update({ lead_id: null })
      .eq('lead_id', id)

    // Everything else cascades or sets-null automatically:
    //   CASCADE: negocios, leads_activities, leads_entries, lead_attachments,
    //            contact_automations*, contact_property_sends, custom_event_leads,
    //            leads_referrals, temp_acompanhamentos, temp_pedidos_credito,
    //            wpp_activity_sessions
    //   SET NULL: visits, wpp_contacts, leads_notifications, property_propostas,
    //             client_satisfaction_surveys
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao eliminar lead', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao eliminar lead:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
