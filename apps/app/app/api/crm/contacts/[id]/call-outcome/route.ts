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

    // 3. Reflect the call outcome on the lead-entry funnel + SLA tracking.
    //    The Leads kanban (leads_entries.status) has two pre-contact stages
    //    inserted before "Contactado":
    //      new/seen → no_answer → no_answer_2plus → processing (Contactado)
    //    so registar uma chamada move automaticamente a lead na pipeline.
    const nowIso = new Date().toISOString()
    if (outcome === 'success') {
      // Reached them → advance any still-open early entry to Contactado.
      await admin
        .from('leads_entries')
        .update({ status: 'processing' })
        .eq('contact_id', contactId)
        .in('status', ['new', 'seen', 'no_answer', 'no_answer_2plus'])
      // First successful contact stops the SLA clock.
      await admin
        .from('leads_entries')
        .update({ first_contact_at: nowIso, sla_status: 'completed' })
        .eq('contact_id', contactId)
        .is('first_contact_at', null)
    } else if (['no_answer', 'busy', 'voicemail'].includes(outcome)) {
      // Tried but didn't reach them → register the attempt on the funnel.
      // Escalate an existing 1st-attempt to "Não atendeu 2+" BEFORE promoting
      // fresh entries, so a brand-new entry only advances one stage.
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

    // 4. Log to goals system
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
