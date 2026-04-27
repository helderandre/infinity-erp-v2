import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { updateNegocioSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'
import { logGoalActivity, pipelineTypeToOrigin } from '@/lib/goals/log-activity'
import { syncLeadEstado } from '@/lib/crm/sync-lead-estado'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createCrmAdminClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('negocios')
      .select(
        `*, leads_pipeline_stages!pipeline_stage_id(*), leads!lead_id(id, nome, email, telemovel, tags, lifecycle_stage_id), dev_users!assigned_consultant_id(id, commercial_name), dev_properties!property_id(id, title, external_ref, city, listing_price)`
      )
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createCrmAdminClient()
    const { id } = await params
    const body = await request.json()

    const parsed = updateNegocioSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const input = parsed.data
    const updatePayload: Record<string, unknown> = { ...input }

    // Remap contact_id → lead_id if present
    if ('contact_id' in updatePayload) {
      updatePayload.lead_id = updatePayload.contact_id
      delete updatePayload.contact_id
    }

    // If the patch touches `temperatura`, capture the previous value + lead_id
    // so we can append a `temperature_change` activity *after* the update lands.
    // Lookup is skipped when `temperatura` isn't in the patch — keeps the
    // common path single-roundtrip.
    let prevTemperatura: string | null = null
    let prevLeadId: string | null = null
    const temperaturaInPatch = (input as { temperatura?: unknown }).temperatura !== undefined
    if (temperaturaInPatch) {
      const { data: current } = await supabase
        .from('negocios')
        .select('temperatura, lead_id')
        .eq('id', id)
        .single()
      prevTemperatura = ((current as unknown) as { temperatura?: string | null })?.temperatura ?? null
      prevLeadId = ((current as unknown) as { lead_id?: string | null })?.lead_id ?? null
    }

    if (input.pipeline_stage_id) {
      const { data: stage, error: stageError } = await supabase
        .from('leads_pipeline_stages')
        .select('id, is_terminal, terminal_type')
        .eq('id', input.pipeline_stage_id)
        .single()

      if (stageError || !stage) {
        return NextResponse.json({ error: 'Fase de pipeline não encontrada' }, { status: 404 })
      }

      if (stage.is_terminal) {
        if (stage.terminal_type === 'won') {
          updatePayload.won_date = new Date().toISOString()
          updatePayload.lost_date = null
        } else if (stage.terminal_type === 'lost') {
          updatePayload.lost_date = new Date().toISOString()
          updatePayload.won_date = null
        }
      }
    }

    const { data, error } = await supabase
      .from('negocios')
      .update(updatePayload)
      .eq('id', id)
      .select(
        `*, leads_pipeline_stages!pipeline_stage_id(*), leads!lead_id(id, nome, email, telemovel, tags, lifecycle_stage_id), dev_users!assigned_consultant_id(id, commercial_name), dev_properties!property_id(id, title, external_ref, city, listing_price)`
      )
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log temperature change to leads_activities so it surfaces in the
    // recent-activity feed alongside stage moves, calls, etc. Best-effort:
    // an insert failure here doesn't break the update.
    if (temperaturaInPatch && data) {
      const newTemperatura = (data as unknown as { temperatura?: string | null }).temperatura ?? null
      const leadId =
        prevLeadId ??
        ((data as unknown as { lead_id?: string | null }).lead_id ?? null)
      if (leadId && newTemperatura !== prevTemperatura) {
        await supabase.from('leads_activities').insert({
          contact_id: leadId,
          negocio_id: id,
          activity_type: 'temperature_change',
          subject: prevTemperatura
            ? `Temperatura: ${prevTemperatura} → ${newTemperatura ?? '—'}`
            : `Temperatura definida: ${newTemperatura ?? '—'}`,
          metadata: {
            from_temperatura: prevTemperatura,
            to_temperatura: newTemperatura,
          },
        })
      }
    }

    // Log deal won to goals system (only via this route if stage was set to terminal won)
    if (input.pipeline_stage_id && data) {
      const stage = await supabase
        .from('leads_pipeline_stages')
        .select('is_terminal, terminal_type, pipeline_type')
        .eq('id', input.pipeline_stage_id)
        .single()

      if (stage.data?.is_terminal && stage.data.terminal_type === 'won') {
        const consultantId = (data as any)?.assigned_consultant_id
        const pipelineType = stage.data.pipeline_type as string
        if (consultantId) {
          // Same recipient-vs-referrer split as /stage route. Prefer the
          // closing price (preco_venda / renda_pretendida) when set.
          const d = data as Record<string, unknown>
          const closedPrice =
            (typeof d.preco_venda === 'number' && d.preco_venda > 0
              ? d.preco_venda
              : null) ??
            (typeof d.renda_pretendida === 'number' && d.renda_pretendida > 0
              ? d.renda_pretendida
              : null) ??
            0
          const expectedValue =
            closedPrice || (typeof d.expected_value === 'number' ? d.expected_value : 0)
          const referrerId = (d.referrer_consultant_id as string | null) ?? null
          const referralPct = ((d.referral_pct as number | null) ?? 0)
          const referrerSlice = referrerId && referralPct > 0
            ? expectedValue * (referralPct / 100)
            : 0
          const recipientRevenue = expectedValue - referrerSlice

          await logGoalActivity({
            consultantId,
            activityType: pipelineType === 'comprador' || pipelineType === 'arrendatario' ? 'buyer_close' : 'sale_close',
            origin: pipelineTypeToOrigin(pipelineType),
            createdBy: consultantId,
            revenueAmount: recipientRevenue || undefined,
            referenceId: id,
            referenceType: 'negocio',
            notes: `Negócio ganho`,
          })

          if (referrerId && referrerSlice > 0) {
            try {
              await logGoalActivity({
                consultantId: referrerId,
                activityType: pipelineType === 'comprador' || pipelineType === 'arrendatario' ? 'buyer_close' : 'sale_close',
                origin: pipelineTypeToOrigin(pipelineType),
                createdBy: consultantId,
                revenueAmount: referrerSlice,
                referenceId: id,
                referenceType: 'negocio',
                notes: `Comissão de referência (${referralPct}%)`,
              })
            } catch (err) {
              console.warn('[crm/negocios PUT] referrer goal-activity log failed:', err)
            }
          }
        }
      }
    }

    const updatedLeadId =
      ((data as unknown as { lead_id?: string | null }).lead_id ?? null) ||
      prevLeadId
    if (updatedLeadId) {
      await syncLeadEstado(supabase, updatedLeadId)
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createCrmAdminClient()
    const { id } = await params

    const { data: existing } = await supabase
      .from('negocios')
      .select('lead_id')
      .eq('id', id)
      .maybeSingle()

    const { error } = await supabase.from('negocios').delete().eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const leadId = (existing as { lead_id?: string | null } | null)?.lead_id
    if (leadId) {
      await syncLeadEstado(supabase, leadId)
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
