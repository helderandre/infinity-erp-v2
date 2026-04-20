import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { respondVisitProposalSchema } from '@/lib/validations/visit'
import { notifyProposalConfirmed, notifyProposalRejected } from '@/lib/visits/notifications'
import { sendEmail } from '@/lib/email/send'

function formatPtDate(date: string | null): string {
  if (!date) return '—'
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-PT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return date
  }
}

function buildConfirmedEmail(params: {
  clientName: string
  propertyTitle: string
  date: string
  time: string
}) {
  return `
    <h2 style="margin:0 0 12px 0; font-size:20px; color:#0a0a0a;">Visita confirmada</h2>
    <p style="margin:0 0 16px 0; color:#4a4a4a; font-size:14px; line-height:1.6;">
      Olá <strong>${params.clientName}</strong>,
    </p>
    <p style="margin:0 0 16px 0; color:#4a4a4a; font-size:14px; line-height:1.6;">
      A sua visita ao imóvel <strong>${params.propertyTitle}</strong> foi confirmada.
    </p>
    <div style="background-color:#f5f5f5; border-radius:12px; padding:16px; margin:20px 0;">
      <p style="margin:0 0 6px 0; font-size:12px; color:#6a6a6a; text-transform:uppercase; letter-spacing:0.5px;">Detalhes</p>
      <p style="margin:0; font-size:14px; color:#0a0a0a;"><strong>Data:</strong> ${formatPtDate(params.date)}</p>
      <p style="margin:0; font-size:14px; color:#0a0a0a;"><strong>Hora:</strong> ${params.time}</p>
    </div>
    <p style="margin:0; color:#4a4a4a; font-size:14px; line-height:1.6;">
      Caso precise de reagendar ou cancelar, entre em contacto connosco.
    </p>
  `
}

function buildRejectedEmail(params: {
  clientName: string
  propertyTitle: string
  reason: string | null
}) {
  return `
    <h2 style="margin:0 0 12px 0; font-size:20px; color:#0a0a0a;">Pedido de visita</h2>
    <p style="margin:0 0 16px 0; color:#4a4a4a; font-size:14px; line-height:1.6;">
      Olá <strong>${params.clientName}</strong>,
    </p>
    <p style="margin:0 0 16px 0; color:#4a4a4a; font-size:14px; line-height:1.6;">
      Infelizmente não foi possível confirmar o seu pedido de visita ao imóvel <strong>${params.propertyTitle}</strong>.
    </p>
    ${params.reason ? `
      <div style="background-color:#f5f5f5; border-radius:12px; padding:16px; margin:20px 0;">
        <p style="margin:0 0 6px 0; font-size:12px; color:#6a6a6a; text-transform:uppercase; letter-spacing:0.5px;">Motivo</p>
        <p style="margin:0; font-size:14px; color:#0a0a0a;">${params.reason}</p>
      </div>
    ` : ''}
    <p style="margin:0; color:#4a4a4a; font-size:14px; line-height:1.6;">
      Pode tentar agendar noutro horário através da mesma página.
    </p>
  `
}

/**
 * POST /api/visits/[id]/respond
 *
 * O seller agent (consultor da angariação) responde a uma proposta de visita
 * que está em status `proposal`. Pode confirmar (`scheduled`) ou rejeitar
 * (`rejected`, com motivo obrigatório).
 *
 * Apenas o `seller_consultant_id` da visita pode chamar este endpoint.
 * Para visitas com booking_source='public' (agendamento público do prospect),
 * após a confirmação criamos lead automaticamente e enviamos email ao prospect.
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

    const { data: visit, error: fetchErr } = await admin
      .from('visits')
      .select(`
        id, status, consultant_id, seller_consultant_id,
        visit_date, visit_time, client_name, client_email, client_phone,
        booking_source, lead_id,
        property:dev_properties!visits_property_id_fkey(title, slug),
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

    // Complete any pending "respond to request" task linked to this visit
    void admin
      .from('tasks')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        completed_by: user.id,
      })
      .eq('entity_type', 'visit')
      .eq('entity_id', visit.id)
      .eq('is_completed', false)
      .then(({ error }: { error: unknown }) => {
        if (error) console.error('[respond task complete]', error)
      })

    // ─── Public booking hooks ───
    if (visit.booking_source === 'public') {
      const propertyTitle = (visit.property as { title?: string } | null)?.title ?? 'Imóvel'

      if (parsed.data.decision === 'confirm') {
        // Auto-create lead if not yet linked
        if (!visit.lead_id && visit.client_email) {
          const { data: createdLead } = await admin
            .from('leads')
            .insert({
              nome: visit.client_name ?? 'Pedido de visita',
              email: visit.client_email,
              telemovel: visit.client_phone ?? null,
              origem: 'website',
              estado: 'novo',
              agent_id: visit.consultant_id,
              observacoes: `Agendou visita pública ao imóvel "${propertyTitle}".`,
            })
            .select('id')
            .single()

          if (createdLead?.id) {
            await admin
              .from('visits')
              .update({ lead_id: createdLead.id })
              .eq('id', visit.id)
          }
        }

        if (visit.client_email) {
          void sendEmail({
            to: visit.client_email,
            subject: `Visita confirmada — ${propertyTitle}`,
            bodyHtml: buildConfirmedEmail({
              clientName: visit.client_name ?? '',
              propertyTitle,
              date: visit.visit_date,
              time: (visit.visit_time ?? '').slice(0, 5),
            }),
          }).catch((err) => console.error('[booking confirm email]', err))
        }
      }

      if (parsed.data.decision === 'reject' && visit.client_email) {
        void sendEmail({
          to: visit.client_email,
          subject: `Pedido de visita — ${propertyTitle}`,
          bodyHtml: buildRejectedEmail({
            clientName: visit.client_name ?? '',
            propertyTitle,
            reason: parsed.data.reason,
          }),
        }).catch((err) => console.error('[booking reject email]', err))
      }
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[visits/[id]/respond POST]', err)
    return NextResponse.json({ error: 'Erro interno ao responder à proposta.' }, { status: 500 })
  }
}
