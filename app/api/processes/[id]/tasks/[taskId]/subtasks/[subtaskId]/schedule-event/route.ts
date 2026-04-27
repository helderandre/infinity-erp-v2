import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { scheduleEventSchema } from '@/lib/validations/calendar'
import { recalculateProgress } from '@/lib/process-engine'
import { logTaskActivity } from '@/lib/processes/activity-logger'

// ---------------------------------------------------------------------------
// POST — Criar ou actualizar evento de calendário a partir de subtarefa
// ---------------------------------------------------------------------------
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string; subtaskId: string }> }
) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const { id: processId, taskId, subtaskId } = await params
    const supabase = await createClient()
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    // Validar body
    const body = await request.json()
    const parsed = scheduleEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const {
      title, description, start_date, end_date, all_day, owner_ids, attendee_user_ids,
      location_label, location_address, latitude, longitude,
      notary_name, notary_phone, notary_email,
    } = parsed.data

    // Verificar que a subtarefa existe e pertence ao processo
    const { data: subtask, error: subtaskError } = await adminDb
      .from('proc_subtasks')
      .select('id, title, config, proc_task_id, is_completed')
      .eq('id', subtaskId)
      .eq('proc_task_id', taskId)
      .single()

    if (subtaskError || !subtask) {
      return NextResponse.json({ error: 'Subtarefa não encontrada.' }, { status: 404 })
    }

    // Verificar que o processo existe
    const { data: proc, error: procError } = await adminDb
      .from('proc_instances')
      .select('id, property_id')
      .eq('id', processId)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })
    }

    const config = (subtask as any).config || {}
    const existingEventId = config.calendar_event_id

    let eventId: string

    if (existingEventId) {
      // UPDATE — evento já existe, actualizar
      const { error: updateError } = await adminDb
        .from('calendar_events')
        .update({
          title,
          description: description || null,
          start_date,
          end_date: end_date || null,
          all_day,
          owner_ids: owner_ids || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingEventId)

      if (updateError) {
        console.error('[schedule-event POST] update error:', updateError)
        return NextResponse.json({ error: 'Erro ao actualizar evento.' }, { status: 500 })
      }

      eventId = existingEventId

      // Actualizar attendees — delete e re-insert
      await adminDb.from('calendar_event_attendees').delete().eq('event_id', eventId)
    } else {
      // INSERT — criar novo evento
      const { data: newEvent, error: insertError } = await adminDb
        .from('calendar_events')
        .insert({
          title,
          description: description || null,
          category: 'process_event',
          start_date,
          end_date: end_date || null,
          all_day,
          process_id: processId,
          proc_subtask_id: subtaskId,
          property_id: (proc as any).property_id || null,
          owner_ids: owner_ids || [],
          visibility: 'all',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (insertError || !newEvent) {
        console.error('[schedule-event POST] insert error:', insertError)
        return NextResponse.json({ error: 'Erro ao criar evento.' }, { status: 500 })
      }

      eventId = (newEvent as any).id
    }

    // Inserir attendees (owners + users)
    const attendeeRows: { event_id: string; user_id: string; status: string }[] = []

    // Adicionar user_ids como attendees
    for (const userId of attendee_user_ids || []) {
      attendeeRows.push({ event_id: eventId, user_id: userId, status: 'accepted' })
    }

    if (attendeeRows.length > 0) {
      await adminDb.from('calendar_event_attendees').insert(attendeeRows)
    }

    // Actualizar config da subtarefa com o event_id
    const updatedConfig = { ...config, type: 'schedule_event', calendar_event_id: eventId }
    const updatePayload: Record<string, unknown> = { config: updatedConfig }

    // Marcar subtarefa como concluída se não estava
    if (!(subtask as any).is_completed) {
      updatePayload.is_completed = true
      updatePayload.completed_at = new Date().toISOString()
      updatePayload.completed_by = user.id
    }

    await adminDb.from('proc_subtasks').update(updatePayload).eq('id', subtaskId)

    // ── PROC-NEG side-effect: sincronizar deal_events ──
    // Se o parent task tiver `config.hook ∈ {schedule_cpcv, schedule_escritura}`,
    // actualizamos a row matching em `deal_events` (event_type derivado
    // do hook + business_type do deal) com a data agendada e os campos
    // de localização/notário se fornecidos. Reschedules incrementam
    // `reschedule_count`.
    try {
      const { data: parentTaskRow } = await adminDb
        .from('proc_tasks')
        .select('config')
        .eq('id', taskId)
        .maybeSingle()

      const parentConfig = (parentTaskRow as { config?: Record<string, unknown> } | null)?.config ?? {}
      const hookName = parentConfig.hook as string | undefined

      if (hookName === 'schedule_cpcv' || hookName === 'schedule_escritura') {
        const { data: dealRow } = await adminDb
          .from('deals')
          .select('id, business_type')
          .eq('proc_instance_id', processId)
          .maybeSingle()

        if (dealRow) {
          const deal = dealRow as { id: string; business_type: string | null }
          const eventType =
            hookName === 'schedule_cpcv'
              ? 'cpcv'
              : (deal.business_type === 'arrendamento' ? 'contrato_arrendamento' : 'escritura')

          // Lookup latest non-done event of this type for this deal
          const { data: existingEvent } = await adminDb
            .from('deal_events')
            .select('id, scheduled_at, reschedule_count, status')
            .eq('deal_id', deal.id)
            .eq('event_type', eventType)
            .not('status', 'in', '("done","cancelled")')
            .order('scheduled_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const dealEventPayload: Record<string, unknown> = {
            scheduled_at: start_date,
          }
          if (location_label !== undefined) dealEventPayload.location_label = location_label
          if (location_address !== undefined) dealEventPayload.location_address = location_address
          if (latitude !== undefined) dealEventPayload.latitude = latitude
          if (longitude !== undefined) dealEventPayload.longitude = longitude
          if (notary_name !== undefined) dealEventPayload.notary_name = notary_name
          if (notary_phone !== undefined) dealEventPayload.notary_phone = notary_phone
          if (notary_email !== undefined) dealEventPayload.notary_email = notary_email

          if (existingEvent) {
            const existing = existingEvent as { id: string; scheduled_at: string | null; reschedule_count: number; status: string }
            // Detectar reschedule: scheduled_at já existia e mudou
            if (existing.scheduled_at && existing.scheduled_at !== start_date) {
              dealEventPayload.reschedule_count = (existing.reschedule_count ?? 0) + 1
              dealEventPayload.last_reschedule_at = new Date().toISOString()
              dealEventPayload.status = 'rescheduled'
            } else if (!existing.scheduled_at) {
              dealEventPayload.status = 'scheduled'
            }

            await adminDb.from('deal_events').update(dealEventPayload).eq('id', existing.id)
          } else {
            // Não há row pré-existente (caso raro — submit sempre cria) — INSERT
            await adminDb.from('deal_events').insert({
              deal_id: deal.id,
              event_type: eventType,
              status: 'scheduled',
              created_by: user.id,
              ...dealEventPayload,
            })
          }
        }
      }
    } catch (syncErr) {
      console.error('[schedule-event][deal_events sync]', syncErr)
      // Não bloqueia o fluxo principal — calendar_events foi criado/actualizado.
    }

    // Recalcular progresso do processo
    await recalculateProgress(processId)

    // Registar actividade
    const isUpdate = !!existingEventId
    await logTaskActivity(
      admin,
      taskId,
      user.id,
      isUpdate ? 'event_updated' : 'event_scheduled',
      isUpdate
        ? `Actualizou o evento "${title}" na subtarefa "${(subtask as any).title}"`
        : `Agendou o evento "${title}" na subtarefa "${(subtask as any).title}"`,
      {
        subtask_id: subtaskId,
        event_id: eventId,
        event_title: title,
        start_date,
        end_date: end_date || null,
        all_day,
      }
    )

    return NextResponse.json({
      data: { event_id: eventId, updated: !!existingEventId },
    }, { status: existingEventId ? 200 : 201 })
  } catch (err) {
    console.error('[schedule-event POST]', err)
    return NextResponse.json(
      { error: 'Erro interno ao agendar evento.' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE — Cancelar evento de calendário e reverter subtarefa
// ---------------------------------------------------------------------------
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; taskId: string; subtaskId: string }> }
) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const { id: processId, taskId, subtaskId } = await params
    const supabase = await createClient()
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    // Verificar subtarefa
    const { data: subtask, error: subtaskError } = await adminDb
      .from('proc_subtasks')
      .select('id, title, config, proc_task_id')
      .eq('id', subtaskId)
      .eq('proc_task_id', taskId)
      .single()

    if (subtaskError || !subtask) {
      return NextResponse.json({ error: 'Subtarefa não encontrada.' }, { status: 404 })
    }

    const config = (subtask as any).config || {}
    const calendarEventId = config.calendar_event_id

    // Reverter subtarefa
    const updatedConfig = { ...config, calendar_event_id: null }
    await adminDb
      .from('proc_subtasks')
      .update({
        config: updatedConfig,
        is_completed: false,
        completed_at: null,
        completed_by: null,
      })
      .eq('id', subtaskId)

    // Eliminar evento do calendário
    if (calendarEventId) {
      await adminDb.from('calendar_event_attendees').delete().eq('event_id', calendarEventId)
      await adminDb.from('calendar_events').delete().eq('id', calendarEventId)
    }

    // Recalcular progresso
    await recalculateProgress(processId)

    // Registar actividade
    await logTaskActivity(
      admin,
      taskId,
      user.id,
      'event_cancelled',
      `Cancelou o evento da subtarefa "${(subtask as any).title}"`,
      {
        subtask_id: subtaskId,
        event_id: calendarEventId || null,
      }
    )

    return NextResponse.json({ data: { cancelled: true } })
  } catch (err) {
    console.error('[schedule-event DELETE]', err)
    return NextResponse.json(
      { error: 'Erro interno ao cancelar evento.' },
      { status: 500 },
    )
  }
}
