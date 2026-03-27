import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { moveNegocioStageSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'
import { logGoalActivity, pipelineTypeToOrigin } from '@/lib/goals/log-activity'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      .select('id, pipeline_stage_id, lead_id, leads_pipeline_stages!pipeline_stage_id(name)')
      .eq('id', id)
      .single()

    if (negocioError || !negocio) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
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
        // Deal won
        await logGoalActivity({
          consultantId,
          activityType: pipelineType === 'comprador' || pipelineType === 'arrendatario' ? 'buyer_close' : 'sale_close',
          origin,
          createdBy: consultantId,
          revenueAmount: (updated as any)?.expected_value || undefined,
          referenceId: id,
          referenceType: 'negocio',
          notes: `Negócio ganho: ${targetStage.name}`,
        })
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

    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
