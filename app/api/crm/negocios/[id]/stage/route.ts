import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { moveNegocioStageSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'
import { logGoalActivity, pipelineTypeToOrigin } from '@/lib/goals/log-activity'
import { requireAuth } from '@/lib/auth/permissions'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { syncLeadEstado } from '@/lib/crm/sync-lead-estado'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id } = await params
    const body = await request.json()

    const parsed = moveNegocioStageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { pipeline_stage_id, lost_reason, lost_notes } = parsed.data

    const { data: negocio, error: negocioError } = await supabase
      .from('negocios')
      .select('id, pipeline_stage_id, lead_id, assigned_consultant_id, leads_pipeline_stages!pipeline_stage_id(name)')
      .eq('id', id)
      .single()

    if (negocioError || !negocio) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    // Authorisation: only the consultor working the deal can move stages.
    // Admins / Brokers bypass for management cases. The Referências page UI
    // already disables drag for the referrer, this is the defence-in-depth
    // layer in case a malicious / out-of-flow caller tries the endpoint.
    const isAdmin = auth.roles.some((r) =>
      ADMIN_ROLES.some((ar) => ar.toLowerCase() === r.toLowerCase()),
    )
    const isOwner =
      (negocio as { assigned_consultant_id?: string }).assigned_consultant_id === auth.user.id
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Apenas o consultor responsável pode mover este negócio' },
        { status: 403 },
      )
    }

    const { data: targetStage, error: stageError } = await supabase
      .from('leads_pipeline_stages')
      .select('id, name, pipeline_type, is_terminal, terminal_type, sla_days')
      .eq('id', pipeline_stage_id)
      .single()

    if (stageError || !targetStage) {
      return NextResponse.json({ error: 'Fase de pipeline não encontrada' }, { status: 404 })
    }

    if (targetStage.is_terminal && targetStage.terminal_type === 'lost' && !lost_reason) {
      return NextResponse.json(
        { error: 'O motivo da perda é obrigatório para esta fase' },
        { status: 400 }
      )
    }

    const updatePayload: Record<string, unknown> = {
      pipeline_stage_id,
      stage_entered_at: new Date().toISOString(),
      // Mirror stage name into the legacy `estado` column so the negocio detail
      // page (which still reads `estado`) stays in sync with the kanban move.
      estado: targetStage.name,
    }

    if (targetStage.is_terminal) {
      if (targetStage.terminal_type === 'won') {
        updatePayload.won_date = new Date().toISOString()
        updatePayload.lost_date = null
        updatePayload.lost_reason = null
        updatePayload.lost_notes = null
      } else if (targetStage.terminal_type === 'lost') {
        updatePayload.lost_date = new Date().toISOString()
        updatePayload.won_date = null
        updatePayload.lost_reason = lost_reason ?? null
        updatePayload.lost_notes = lost_notes ?? null
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('negocios')
      .update(updatePayload)
      .eq('id', id)
      .select(
        `*, leads_pipeline_stages!pipeline_stage_id(*), leads!lead_id(id, nome, email, telemovel, tags), dev_users!assigned_consultant_id(id, commercial_name)`
      )
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    const fromStageName =
      (negocio.leads_pipeline_stages as unknown as { name: string } | null)?.name ?? null

    await supabase.from('leads_activities').insert({
      contact_id: negocio.lead_id,
      negocio_id: id,
      activity_type: 'stage_change',
      description: `Fase alterada de "${fromStageName}" para "${targetStage.name}"`,
      metadata: {
        from_stage_id: negocio.pipeline_stage_id,
        from_stage_name: fromStageName,
        to_stage_id: pipeline_stage_id,
        to_stage_name: targetStage.name,
      },
    })

    // Log to goals system
    const consultantId = (updated as any)?.assigned_consultant_id
    const pipelineType = targetStage.pipeline_type as string
    const origin = pipelineTypeToOrigin(pipelineType)

    if (consultantId) {
      if (targetStage.is_terminal && targetStage.terminal_type === 'won') {
        // Deal won — credit the recipient (consultor working the deal).
        // Prefer the actual closing price (preco_venda / renda_pretendida)
        // over expected_value, since negotiations typically adjust the
        // number between qualification and close. Fallback to expected_value
        // when neither is set yet.
        const u = updated as Record<string, unknown>
        const closedPrice =
          (typeof u.preco_venda === 'number' && u.preco_venda > 0
            ? u.preco_venda
            : null) ??
          (typeof u.renda_pretendida === 'number' && u.renda_pretendida > 0
            ? u.renda_pretendida
            : null) ??
          0
        const expectedValue =
          closedPrice || (typeof u.expected_value === 'number' ? u.expected_value : 0)
        const referrerId = (u.referrer_consultant_id as string | null) ?? null
        const referralPct = ((u.referral_pct as number | null) ?? 0)
        const referrerSlice = referrerId && referralPct > 0
          ? expectedValue * (referralPct / 100)
          : 0
        const recipientRevenue = expectedValue - referrerSlice

        await logGoalActivity({
          consultantId,
          activityType: pipelineType === 'comprador' || pipelineType === 'arrendatario' ? 'buyer_close' : 'sale_close',
          origin,
          createdBy: consultantId,
          revenueAmount: recipientRevenue || undefined,
          referenceId: id,
          referenceType: 'negocio',
          notes: `Negócio ganho: ${targetStage.name}`,
        })

        // Credit the referrer with their commission slice. Skipped silently
        // if the négocio wasn't referred internally. Errors here don't block
        // the recipient's win — best-effort.
        if (referrerId && referrerSlice > 0) {
          try {
            await logGoalActivity({
              consultantId: referrerId,
              activityType: pipelineType === 'comprador' || pipelineType === 'arrendatario' ? 'buyer_close' : 'sale_close',
              origin,
              createdBy: consultantId,
              revenueAmount: referrerSlice,
              referenceId: id,
              referenceType: 'negocio',
              notes: `Comissão de referência: ${targetStage.name} (${referralPct}%)`,
            })
          } catch (err) {
            console.warn('[stage/route] referrer goal-activity log failed:', err)
          }
        }
      } else if (targetStage.is_terminal && targetStage.terminal_type === 'lost') {
        // Deal lost — no goal activity (losses don't count as positive activity)
      } else {
        // Regular stage change — log as qualification/follow-up depending on context
        const isQualification = (targetStage as any).probability_pct > 30
        if (isQualification && (pipelineType === 'comprador' || pipelineType === 'arrendatario')) {
          await logGoalActivity({
            consultantId,
            activityType: 'buyer_qualify',
            origin,
            createdBy: consultantId,
            referenceId: id,
            referenceType: 'negocio',
            notes: `Qualificação: ${fromStageName} → ${targetStage.name}`,
          })
        }
      }
    }

    if (negocio.lead_id) {
      await syncLeadEstado(supabase, negocio.lead_id as string)
    }

    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
