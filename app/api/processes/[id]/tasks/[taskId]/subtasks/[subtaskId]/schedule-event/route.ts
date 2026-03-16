import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { scheduleEventSchema } from '@/lib/validations/calendar'
import { recalculateProgress } from '@/lib/process-engine'

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

    const { title, description, start_date, end_date, all_day, owner_ids, attendee_user_ids } = parsed.data

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
        .from('temp_calendar_events')
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
      await adminDb.from('temp_calendar_event_attendees').delete().eq('event_id', eventId)
    } else {
      // INSERT — criar novo evento
      const { data: newEvent, error: insertError } = await adminDb
        .from('temp_calendar_events')
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
      await adminDb.from('temp_calendar_event_attendees').insert(attendeeRows)
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

    // Recalcular progresso do processo
    await recalculateProgress(processId)

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
