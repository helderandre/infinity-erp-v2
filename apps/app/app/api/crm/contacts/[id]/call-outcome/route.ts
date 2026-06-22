import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'
import { logGoalActivity, pipelineTypeToOrigin } from '@/lib/goals/log-activity'

const VALID_OUTCOMES = ['success', 'failed', 'no_answer', 'busy', 'voicemail'] as const
type Outcome = (typeof VALID_OUTCOMES)[number]

const OUTCOME_LABELS: Record<Outcome, string> = {
  success: 'Chamada atendida',
  no_answer: 'Sem resposta',
  busy: 'Ocupado',
  voicemail: 'Caixa de correio de voz',
  failed: 'Chamada não atendida',
}

type CrmAdmin = ReturnType<typeof createCrmAdminClient>

/**
 * Derive the goals funnel side (sellers/buyers) for a call.
 * Prefers the opportunity the call was placed from; otherwise infers it from the
 * lead's own negócios, but only trusts the inference when it is unambiguous.
 * Falls back to 'sellers' (the historical default) when the side is unknown.
 */
async function resolveGoalOrigin(
  admin: CrmAdmin,
  negocioId: string | null | undefined,
  leadId: string,
): Promise<'sellers' | 'buyers'> {
  try {
    let stageIds: string[] = []

    if (negocioId) {
      const { data } = await admin
        .from('negocios')
        .select('pipeline_stage_id')
        .eq('id', negocioId)
        .maybeSingle()
      if (data?.pipeline_stage_id) stageIds = [data.pipeline_stage_id]
    }

    if (stageIds.length === 0) {
      const { data: negs } = await admin
        .from('negocios')
        .select('pipeline_stage_id')
        .eq('lead_id', leadId)
      stageIds = [
        ...new Set(
          (negs ?? [])
            .map((n: { pipeline_stage_id: string | null }) => n.pipeline_stage_id)
            .filter(Boolean) as string[],
        ),
      ]
    }

    if (stageIds.length === 0) return 'sellers'

    const { data: stages } = await admin
      .from('leads_pipeline_stages')
      .select('pipeline_type')
      .in('id', stageIds)

    const origins = [
      ...new Set(
        (stages ?? []).map((s: { pipeline_type: string }) => pipelineTypeToOrigin(s.pipeline_type)),
      ),
    ]
    return origins.length === 1 ? origins[0] : 'sellers'
  } catch {
    return 'sellers'
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id: contactId } = await params
    const body = await request.json()
    const { outcome, direction: callDirection, notes, negocio_id, request_id } = body
    const direction = callDirection === 'inbound' ? 'inbound' : 'outbound'

    if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
      return NextResponse.json({ error: 'Resultado inválido' }, { status: 400 })
    }

    const admin = createCrmAdminClient()

    // `contactId` is a leads.id in the unified pipeline. Both
    // leads_activities.contact_id and leads_entries.contact_id FK to leads.id.
    const { data: lead, error: leadError } = await admin
      .from('leads')
      .select('id, agent_id, lifecycle_stage_id')
      .eq('id', contactId)
      .maybeSingle()

    if (leadError) {
      console.error('[call-outcome] lead lookup failed:', leadError)
      return NextResponse.json({ error: 'Erro ao consultar o contacto' }, { status: 500 })
    }
    if (!lead) {
      return NextResponse.json({ error: 'Contacto não encontrado' }, { status: 404 })
    }

    // Idempotency (M6): a double-tap sends the same request_id. If we already
    // logged it for this contact, return the prior result without re-writing.
    if (request_id) {
      const { data: existing } = await admin
        .from('leads_activities')
        .select('id')
        .eq('contact_id', contactId)
        .eq('metadata->>request_id', request_id)
        .limit(1)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ success: true, outcome, stage_updated: false, deduped: true })
      }
    }

    const activityDescription = OUTCOME_LABELS[outcome as Outcome]

    // 1. PRIMARY WRITE — the contact-history row. If this fails the whole
    //    operation failed: registering the outcome IS the point of the feature,
    //    so we surface a 500 instead of silently reporting success.
    const { error: activityError } = await admin.from('leads_activities').insert({
      contact_id: contactId,
      negocio_id: negocio_id || null,
      activity_type: 'call',
      direction,
      subject: activityDescription,
      description: notes || null,
      metadata: { outcome, direction, timestamp: new Date().toISOString(), request_id: request_id || null },
      created_by: user.id,
    })

    if (activityError) {
      console.error('[call-outcome] failed to write contact history:', activityError)
      return NextResponse.json({ error: 'Erro ao registar o contacto' }, { status: 500 })
    }

    // ── Secondary effects below are best-effort: they must never fail the
    //    request now that the history row is safely persisted. ──────────────

    // 2. Lifecycle bump Lead → Contactado on the first answered call.
    let stageUpdated = false
    if (outcome === 'success' && lead.lifecycle_stage_id) {
      try {
        const { data: currentStage } = await admin
          .from('leads_contact_stages')
          .select('id, name, order_index')
          .eq('id', lead.lifecycle_stage_id)
          .maybeSingle()

        if (currentStage && currentStage.order_index === 0) {
          const { data: contactadoStage } = await admin
            .from('leads_contact_stages')
            .select('id, name')
            .eq('name', 'Contactado')
            .limit(1)
            .maybeSingle()

          if (contactadoStage) {
            // Guard on the current stage to avoid clobbering a concurrent bump.
            const { error: bumpError } = await admin
              .from('leads')
              .update({ lifecycle_stage_id: contactadoStage.id })
              .eq('id', contactId)
              .eq('lifecycle_stage_id', lead.lifecycle_stage_id)

            if (!bumpError) {
              stageUpdated = true
              await admin.from('leads_activities').insert({
                contact_id: contactId,
                activity_type: 'lifecycle_change',
                subject: `${currentStage.name} → ${contactadoStage.name}`,
                description: 'Alteração automática após primeira chamada atendida',
                metadata: {
                  from_stage: currentStage.name,
                  to_stage: contactadoStage.name,
                  trigger: 'call_success',
                },
                created_by: user.id,
              })
            }
          }
        }
      } catch (err) {
        console.warn('[call-outcome] lifecycle bump failed:', err)
      }
    }

    // 3. Reflect the outcome on the lead-entry funnel + SLA tracking.
    //    Pre-contact funnel: new/seen → no_answer → no_answer_2plus → processing.
    try {
      const nowIso = new Date().toISOString()
      if (outcome === 'success') {
        // Reached them → advance any still-open early entry to Contactado…
        await admin
          .from('leads_entries')
          .update({ status: 'processing' })
          .eq('contact_id', contactId)
          .in('status', ['new', 'seen', 'no_answer', 'no_answer_2plus'])
        // …and stop the SLA clock on first contact (only once).
        await admin
          .from('leads_entries')
          .update({ first_contact_at: nowIso, sla_status: 'completed' })
          .eq('contact_id', contactId)
          .is('first_contact_at', null)
      } else if (['no_answer', 'busy', 'voicemail'].includes(outcome)) {
        // Tried but didn't reach them → escalate an existing 1st attempt BEFORE
        // promoting a fresh entry, so a brand-new entry only advances one stage.
        await admin
          .from('leads_entries')
          .update({ status: 'no_answer_2plus' })
          .eq('contact_id', contactId)
          .eq('status', 'no_answer')
        await admin
          .from('leads_entries')
          .update({ status: 'no_answer' })
          .eq('contact_id', contactId)
          .in('status', ['new', 'seen'])
      }
    } catch (err) {
      console.warn('[call-outcome] funnel/SLA update failed:', err)
    }

    // 4. Goals — only an ANSWERED call counts as a "contacto efetivo".
    //    Attempts (no_answer/busy/voicemail/failed) live in the history and the
    //    funnel, but must not inflate the objetivos "Chamadas" target.
    if (outcome === 'success') {
      try {
        const origin = await resolveGoalOrigin(admin, negocio_id, contactId)
        // Credit the lead's owner (assignee), matching the pre-existing policy.
        const consultantId = lead.agent_id || user.id

        // 4a. CANONICAL v2 ledger — agent_funnel_events drives the primary
        //     /dashboard/objetivos funil. This endpoint is the SOLE writer of
        //     'contacto' events for calls (CallContactButton no longer writes
        //     funnel events directly). Its unique index dedups one 'contacto'
        //     per (source_ref, side, stage), so repeat calls don't double-count.
        const funnelSide = origin === 'buyers' ? 'comprador' : 'vendedor'
        const { error: funnelError } = await admin.from('agent_funnel_events').insert({
          agent_id: consultantId,
          side: funnelSide,
          stage: 'contacto',
          occurred_at: new Date().toISOString(),
          count: 1,
          source: 'call_outcome',
          source_ref_type: negocio_id ? 'negocio' : 'lead',
          source_ref_id: negocio_id || contactId,
          notes: activityDescription,
          created_by: user.id,
        })
        // 23505 = already counted for this source/side/stage → expected, ignore.
        if (funnelError && funnelError.code !== '23505') {
          console.warn('[call-outcome] funnel event insert failed:', funnelError)
        }

        // 4b. Legacy ledger — kept so the older /api/goals/* dashboards stay
        //     populated. Safe to retire once those views move to v2.
        await logGoalActivity({
          consultantId,
          activityType: 'call',
          origin,
          direction,
          createdBy: user.id,
          referenceId: contactId,
          referenceType: 'lead',
          notes: activityDescription,
        })
      } catch (err) {
        console.warn('[call-outcome] goals logging failed:', err)
      }
    }

    return NextResponse.json({
      success: true,
      outcome,
      stage_updated: stageUpdated,
    })
  } catch (error) {
    console.error('Call outcome error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
