import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { visitOutcomeSchema } from '@/lib/validations/visit'
import { notifyFichaPending } from '@/lib/visits/notifications'

/**
 * POST /api/visits/[id]/outcome
 *
 * Regista o desfecho de uma visita: completed | no_show | cancelled.
 * Pode ser chamado pelo seller agent (preferencial) ou pelo buyer agent
 * (fallback após 12h sem resposta do seller).
 *
 * Pre-condição: a visita tem de estar em `scheduled`. Não se pode definir
 * outcome de uma proposta nem de uma visita já desfecha.
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
    const parsed = visitOutcomeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    // Buscar a visita actual + dados para notificações
    const { data: visit, error: fetchErr } = await admin
      .from('visits')
      .select(`
        id, status, consultant_id, seller_consultant_id, outcome_set_at,
        visit_date, visit_time, client_name,
        property:dev_properties!visits_property_id_fkey(title, slug),
        lead:leads!visits_lead_id_fkey(nome)
      `)
      .eq('id', id)
      .single()

    if (fetchErr || !visit) {
      return NextResponse.json({ error: 'Visita não encontrada.' }, { status: 404 })
    }

    if (visit.status !== 'scheduled') {
      return NextResponse.json(
        { error: `Apenas visitas agendadas podem ter outcome (estado actual: ${visit.status}).` },
        { status: 409 }
      )
    }

    // Apenas o buyer agent ou o seller agent podem definir o outcome
    const isBuyerAgent = visit.consultant_id === user.id
    const isSellerAgent = visit.seller_consultant_id === user.id
    if (!isBuyerAgent && !isSellerAgent) {
      return NextResponse.json(
        { error: 'Apenas os consultores envolvidos podem registar o desfecho desta visita.' },
        { status: 403 }
      )
    }

    const updateData: Record<string, unknown> = {
      status: parsed.data.outcome,
      outcome_set_at: new Date().toISOString(),
      outcome_set_by: user.id,
    }

    if (parsed.data.outcome === 'cancelled') {
      updateData.cancelled_reason = parsed.data.reason
      updateData.cancelled_by = user.id
    }

    const { data, error } = await admin
      .from('visits')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[visits/[id]/outcome POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Quando a visita fica marcada como `completed`, gera entradas no
    // `temp_goal_activity_log` para os consultores envolvidos:
    //  - Buyer agent (visit.consultant_id) → origin='buyers', quantity=1
    //  - Seller agent (visit.seller_consultant_id) → origin='sellers', quantity=1
    // Quando é o mesmo consultor dos dois lados, são inseridas as duas linhas
    // (regra confirmada: visita própria em angariação própria conta para ambos
    // os contadores nas métricas dos objectivos).
    if (parsed.data.outcome === 'completed') {
      const buyerAgentId = visit.consultant_id
      const sellerAgentId = visit.seller_consultant_id
      const visitDate = visit.visit_date

      // Idempotência: verificar se já existem entradas para esta visita
      // (caso o endpoint seja chamado mais que uma vez por algum motivo).
      const { data: existing } = await admin
        .from('temp_goal_activity_log')
        .select('id, origin')
        .eq('reference_id', visit.id)
        .eq('reference_type', 'visit')
        .eq('activity_type', 'visit')

      const existingOrigins = new Set((existing ?? []).map((e: any) => e.origin))

      const rowsToInsert: any[] = []
      if (buyerAgentId && !existingOrigins.has('buyers')) {
        rowsToInsert.push({
          consultant_id: buyerAgentId,
          activity_date: visitDate,
          activity_type: 'visit',
          origin: 'buyers',
          reference_id: visit.id,
          reference_type: 'visit',
          quantity: 1,
          direction: 'outbound',
          origin_type: 'system',
          created_by: user.id,
          notes: 'Visita realizada (auto a partir do registo de desfecho)',
        })
      }
      if (sellerAgentId && !existingOrigins.has('sellers')) {
        rowsToInsert.push({
          consultant_id: sellerAgentId,
          activity_date: visitDate,
          activity_type: 'visit',
          origin: 'sellers',
          reference_id: visit.id,
          reference_type: 'visit',
          quantity: 1,
          direction: 'outbound',
          origin_type: 'system',
          created_by: user.id,
          notes: 'Visita realizada (auto a partir do registo de desfecho)',
        })
      }

      if (rowsToInsert.length > 0) {
        const { error: logErr } = await admin
          .from('temp_goal_activity_log')
          .insert(rowsToInsert)
        if (logErr) {
          // Não bloqueia a resposta — o desfecho ficou registado, só falhou
          // a sincronização com os objectivos. Log para debug.
          console.error('[visits/[id]/outcome] failed to insert goal activity log:', logErr)
        }
      }

      // Push ao buyer agent para preencher a ficha
      void notifyFichaPending(admin, buyerAgentId, {
        id: visit.id,
        property_title: (visit.property as { title?: string } | null)?.title ?? null,
        property_slug: (visit.property as { slug?: string } | null)?.slug ?? null,
        client_name: (visit.lead as { nome?: string } | null)?.nome ?? visit.client_name ?? null,
        visit_date: visit.visit_date,
        visit_time: visit.visit_time,
      })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[visits/[id]/outcome POST]', err)
    return NextResponse.json({ error: 'Erro interno ao registar desfecho.' }, { status: 500 })
  }
}
