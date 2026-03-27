// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { logGoalActivity } from '@/lib/goals/log-activity'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id: contactId } = await params
    const body = await request.json()
    const { outcome, direction: callDirection, notes, negocio_id } = body
    const direction = callDirection === 'inbound' ? 'inbound' : 'outbound'

    if (!outcome || !['success', 'failed', 'no_answer', 'busy', 'voicemail'].includes(outcome)) {
      return NextResponse.json({ error: 'Resultado inválido' }, { status: 400 })
    }

    const admin = createAdminClient()

    const activityDescription = outcome === 'success'
      ? 'Chamada atendida'
      : outcome === 'no_answer'
        ? 'Sem resposta'
        : outcome === 'busy'
          ? 'Ocupado'
          : outcome === 'voicemail'
            ? 'Caixa de correio de voz'
            : 'Chamada não atendida'

    // Detect if this is a CRM contact (leads_contacts) or old lead (leads)
    const { data: crmContact } = await admin
      .from('leads_contacts')
      .select('id, lifecycle_stage_id, assigned_consultant_id')
      .eq('id', contactId)
      .maybeSingle()

    const isCrmContact = !!crmContact

    // 1. Log the call activity to the appropriate table
    if (isCrmContact) {
      await admin
        .from('leads_activities')
        .insert({
          contact_id: contactId,
          negocio_id: negocio_id || null,
          activity_type: 'call',
          direction,
          subject: activityDescription,
          description: notes || null,
          metadata: { outcome, direction, timestamp: new Date().toISOString() },
          created_by: user.id,
        })
    } else {
      // Old leads table — log to lead_activities
      await admin
        .from('lead_activities')
        .insert({
          lead_id: contactId,
          agent_id: user.id,
          activity_type: 'call',
          description: `${activityDescription}${notes ? ` — ${notes}` : ''}`,
          metadata: { outcome, direction, timestamp: new Date().toISOString() },
        })
    }

    // 2. If successful call and CRM contact is still "Lead", upgrade to "Contactado"
    let stageUpdated = false
    if (outcome === 'success' && isCrmContact) {
      const { data: stageInfo } = await admin
        .from('leads_contacts')
        .select('lifecycle_stage_id, leads_contact_stages(name, order_index)')
        .eq('id', contactId)
        .single()

      const stage = stageInfo?.leads_contact_stages
      if (stage && stage.order_index === 0) {
        const { data: nextStage } = await admin
          .from('leads_contact_stages')
          .select('id, name')
          .eq('name', 'Contactado')
          .single()

        if (nextStage) {
          await admin
            .from('leads_contacts')
            .update({ lifecycle_stage_id: nextStage.id })
            .eq('id', contactId)

          await admin
            .from('leads_activities')
            .insert({
              contact_id: contactId,
              activity_type: 'lifecycle_change',
              subject: `${stage.name} → ${nextStage.name}`,
              description: 'Alteração automática após primeira chamada atendida',
              metadata: { from_stage: stage.name, to_stage: nextStage.name, trigger: 'call_success' },
              created_by: user.id,
            })

          stageUpdated = true
        }
      }
    }

    // 3. Log to goals system
    await logGoalActivity({
      consultantId: crmContact?.assigned_consultant_id || user.id,
      activityType: 'call',
      origin: 'sellers',
      direction,
      createdBy: user.id,
      referenceId: contactId,
      referenceType: 'lead',
      notes: activityDescription,
    })

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
