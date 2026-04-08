import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { respondVisitProposalSchema } from '@/lib/validations/visit'
import { notifyProposalConfirmed, notifyProposalRejected } from '@/lib/visits/notifications'

/**
 * POST /api/visits/[id]/respond
 *
 * O seller agent (consultor da angariação) responde a uma proposta de visita
 * que está em status `proposal`. Pode confirmar (`scheduled`) ou rejeitar
 * (`rejected`, com motivo obrigatório).
 *
 * Apenas o `seller_consultant_id` da visita pode chamar este endpoint.
 * Notificações push ao buyer agent são disparadas no fim (TODO: integrar
 * com sendPushToUser quando estivermos no passo das notificações).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = respondVisitProposalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    // Buscar a visita actual + verificar precondições. Trazemos também
    // os dados necessários para a notificação push (título, cliente, data).
    const { data: visit, error: fetchErr } = await admin
      .from('visits')
      .select(`
        id, status, consultant_id, seller_consultant_id,
        visit_date, visit_time, client_name,
        property:dev_properties!visits_property_id_fkey(title),
        lead:leads!visits_lead_id_fkey(nome)
      `)
      .eq('id', id)
      .single()

    if (fetchErr || !visit) {
      return NextResponse.json({ error: 'Visita não encontrada.' }, { status: 404 })
    }

    if (visit.status !== 'proposal') {
      return NextResponse.json(
        { error: `Esta visita já não está em proposta (estado actual: ${visit.status}).` },
        { status: 409 }
      )
    }

    // Apenas o seller agent pode responder à proposta
    if (visit.seller_consultant_id !== user.id) {
      return NextResponse.json(
        { error: 'Apenas o consultor da angariação pode responder a esta proposta.' },
        { status: 403 }
      )
    }

    const updateData: Record<string, unknown> = {
      proposal_responded_at: new Date().toISOString(),
      proposal_responded_by: user.id,
    }

    if (parsed.data.decision === 'confirm') {
      updateData.status = 'scheduled'
    } else {
      updateData.status = 'rejected'
      updateData.rejected_reason = parsed.data.reason
    }

    const { data, error } = await admin
      .from('visits')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[visits/[id]/respond POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Push: notificar o buyer agent (visit.consultant_id) com a decisão.
    const ctx = {
      id: visit.id,
      property_title: (visit.property as { title?: string } | null)?.title ?? null,
      client_name: (visit.lead as { nome?: string } | null)?.nome ?? visit.client_name ?? null,
      visit_date: visit.visit_date,
      visit_time: visit.visit_time,
    }
    if (parsed.data.decision === 'confirm') {
      void notifyProposalConfirmed(admin, visit.consultant_id, ctx)
    } else {
      void notifyProposalRejected(admin, visit.consultant_id, ctx, parsed.data.reason)
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[visits/[id]/respond POST]', err)
    return NextResponse.json({ error: 'Erro interno ao responder à proposta.' }, { status: 500 })
  }
}
