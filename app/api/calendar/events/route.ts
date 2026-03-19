import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { calendarEventSchema } from '@/lib/validations/calendar'
import type { CalendarEvent, CalendarCategory } from '@/types/calendar'

// ---------------------------------------------------------------------------
// Color mapping by category
// ---------------------------------------------------------------------------
const CATEGORY_COLORS: Record<CalendarCategory, string> = {
  contract_expiry: 'amber-500',
  lead_expiry: 'red-500',
  lead_followup: 'yellow-500',
  process_task: 'violet-500',
  process_subtask: 'teal-500',
  process_event: 'cyan-500',
  birthday: 'pink-500',
  vacation: 'slate-400',
  company_event: 'emerald-500',
  marketing_event: 'orange-500',
  meeting: 'indigo-500',
  reminder: 'sky-500',
  custom: 'stone-500',
}

// ---------------------------------------------------------------------------
// GET — Aggregate calendar events from multiple sources
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const categoriesParam = searchParams.get('categories')
    const userId = searchParams.get('user_id')

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Parâmetros start e end são obrigatórios (formato ISO)' },
        { status: 400 },
      )
    }

    const startDate = new Date(start)
    const endDate = new Date(end)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Datas inválidas. Usar formato ISO.' },
        { status: 400 },
      )
    }

    const requestedCategories: CalendarCategory[] | null = categoriesParam
      ? (categoriesParam.split(',') as CalendarCategory[])
      : null

    const now = new Date().toISOString()
    const admin = createAdminClient() as any

    // Run all queries in parallel
    const [
      manualRes,
      contractExpiryRes,
      leadExpiryRes,
      procTasksRes,
      procSubtasksRes,
    ] = await Promise.all([
      // 1. Manual events from calendar_events
      admin
        .from('calendar_events')
        .select('*, creator:dev_users!calendar_events_created_by_fkey(commercial_name), linked_user:dev_users!calendar_events_user_id_fkey(commercial_name), proc_instances(id, external_ref)')
        .or(
          `and(is_recurring.eq.false,start_date.gte.${start},start_date.lte.${end}),` +
          `and(is_recurring.eq.false,end_date.gte.${start},end_date.lte.${end}),` +
          `is_recurring.eq.true`
        ),

      // 2. Contract expiry dates in range
      admin
        .from('dev_property_internal')
        .select('property_id, contract_expiry, dev_properties(id, title, consultant_id)')
        .gte('contract_expiry', start)
        .lte('contract_expiry', end),

      // 3. Lead expiry dates in range
      admin
        .from('leads')
        .select('id, nome, expires_at, assigned_agent_id, agent:dev_users!leads_assigned_agent_id_fkey(id, commercial_name)')
        .gte('expires_at', start)
        .lte('expires_at', end),

      // 4a. Process tasks with due_date (from active/on_hold processes, not deleted)
      admin
        .from('proc_tasks')
        .select(`
          id, title, due_date, status, priority, assigned_to, stage_name,
          proc_instance_id,
          proc_instances!inner(id, external_ref, current_status, deleted_at, property_id,
            dev_properties(id, title)
          ),
          assignee:dev_users!proc_tasks_assigned_to_fkey(id, commercial_name)
        `)
        .not('due_date', 'is', null)
        .not('status', 'in', '("completed","skipped")')
        .is('proc_instances.deleted_at', null)
        .in('proc_instances.current_status', ['active', 'on_hold'])
        .gte('due_date', start)
        .lte('due_date', end),

      // 4b. Process subtasks with due_date (from active/on_hold processes, not deleted)
      admin
        .from('proc_subtasks')
        .select(`
          id, title, due_date, is_completed, priority, assigned_to, owner_id,
          config, proc_task_id,
          proc_tasks!inner(id, title, stage_name, proc_instance_id,
            proc_instances!inner(id, external_ref, current_status, deleted_at, property_id,
              dev_properties(id, title)
            )
          ),
          assignee:dev_users!proc_subtasks_assigned_to_fkey(id, commercial_name),
          owners(id, name)
        `)
        .not('due_date', 'is', null)
        .eq('is_completed', false)
        .is('proc_tasks.proc_instances.deleted_at', null)
        .in('proc_tasks.proc_instances.current_status', ['active', 'on_hold'])
        .gte('due_date', start)
        .lte('due_date', end),
    ])

    const events: CalendarEvent[] = []

    // ------ Resolve owner names for process_event events ------
    const processEvents = (manualRes.data ?? []).filter(
      (ev: any) => ev.category === 'process_event' && ev.owner_ids?.length,
    )
    const allOwnerIds = [...new Set(processEvents.flatMap((ev: any) => ev.owner_ids as string[]))]
    let ownerNameMap: Record<string, string> = {}
    if (allOwnerIds.length > 0) {
      const { data: ownerRows } = await admin
        .from('owners')
        .select('id, name')
        .in('id', allOwnerIds)
      if (ownerRows) {
        ownerNameMap = Object.fromEntries(ownerRows.map((o: any) => [o.id, o.name]))
      }
    }

    // ------ 1. Manual events ------
    if (manualRes.data) {
      for (const ev of manualRes.data) {
        // For recurring yearly events, check if month/day falls in range
        if (ev.is_recurring && ev.recurrence_rule === 'yearly') {
          const occurrences = getYearlyOccurrences(ev.start_date, startDate, endDate)
          for (const occ of occurrences) {
            events.push({
              id: `${ev.id}_${occ.toISOString()}`,
              title: ev.title,
              description: ev.description ?? undefined,
              category: ev.category as CalendarCategory,
              start_date: occ.toISOString(),
              end_date: ev.end_date
                ? shiftDateToYear(ev.end_date, occ.getFullYear()).toISOString()
                : undefined,
              all_day: ev.all_day ?? false,
              color: ev.color || CATEGORY_COLORS[ev.category as CalendarCategory] || 'gray-500',
              source: 'manual',
              is_recurring: true,
              is_overdue: false,
              user_id: ev.user_id ?? undefined,
              user_name: (ev.linked_user as { commercial_name: string } | null)?.commercial_name ?? undefined,
              property_id: ev.property_id ?? undefined,
              lead_id: ev.lead_id ?? undefined,
            })
          }
        } else if (ev.is_recurring && ev.recurrence_rule === 'monthly') {
          const occurrences = getMonthlyOccurrences(ev.start_date, startDate, endDate)
          for (const occ of occurrences) {
            events.push({
              id: `${ev.id}_${occ.toISOString()}`,
              title: ev.title,
              description: ev.description ?? undefined,
              category: ev.category as CalendarCategory,
              start_date: occ.toISOString(),
              end_date: undefined,
              all_day: ev.all_day ?? false,
              color: ev.color || CATEGORY_COLORS[ev.category as CalendarCategory] || 'gray-500',
              source: 'manual',
              is_recurring: true,
              is_overdue: false,
              user_id: ev.user_id ?? undefined,
              user_name: (ev.linked_user as { commercial_name: string } | null)?.commercial_name ?? undefined,
              property_id: ev.property_id ?? undefined,
              lead_id: ev.lead_id ?? undefined,
            })
          }
        } else if (ev.is_recurring && ev.recurrence_rule === 'weekly') {
          const occurrences = getWeeklyOccurrences(ev.start_date, startDate, endDate)
          for (const occ of occurrences) {
            events.push({
              id: `${ev.id}_${occ.toISOString()}`,
              title: ev.title,
              description: ev.description ?? undefined,
              category: ev.category as CalendarCategory,
              start_date: occ.toISOString(),
              end_date: undefined,
              all_day: ev.all_day ?? false,
              color: ev.color || CATEGORY_COLORS[ev.category as CalendarCategory] || 'gray-500',
              source: 'manual',
              is_recurring: true,
              is_overdue: false,
              user_id: ev.user_id ?? undefined,
              user_name: (ev.linked_user as { commercial_name: string } | null)?.commercial_name ?? undefined,
              property_id: ev.property_id ?? undefined,
              lead_id: ev.lead_id ?? undefined,
            })
          }
        } else {
          // Non-recurring event already in range
          const proc = ev.proc_instances as { id: string; external_ref: string } | null
          const isProcessEvent = ev.category === 'process_event'

          events.push({
            id: ev.id,
            title: ev.title,
            description: ev.description ?? undefined,
            category: ev.category as CalendarCategory,
            start_date: ev.start_date,
            end_date: ev.end_date ?? undefined,
            all_day: ev.all_day ?? false,
            color: ev.color || CATEGORY_COLORS[ev.category as CalendarCategory] || 'gray-500',
            source: 'manual',
            is_recurring: false,
            is_overdue: false,
            user_id: ev.user_id ?? undefined,
            user_name: (ev.linked_user as { commercial_name: string } | null)?.commercial_name ?? undefined,
            property_id: ev.property_id ?? undefined,
            lead_id: ev.lead_id ?? undefined,
            // Campos de processo (para process_event)
            ...(isProcessEvent && proc ? {
              process_id: proc.id,
              process_ref: proc.external_ref,
            } : {}),
            ...(isProcessEvent ? {
              proc_subtask_id: ev.proc_subtask_id ?? undefined,
              owner_ids: ev.owner_ids ?? undefined,
              owners: (ev.owner_ids ?? []).map((oid: string) => ({
                id: oid,
                name: ownerNameMap[oid] ?? oid,
              })),
            } : {}),
            // Origem WhatsApp
            wpp_message_id: ev.wpp_message_id ?? undefined,
          })
        }
      }
    }

    // ------ 2. Contract expiry ------
    if (contractExpiryRes.data) {
      for (const row of contractExpiryRes.data) {
        const property = row.dev_properties as { id: string; title: string; consultant_id: string } | null
        const isOverdue = row.contract_expiry < now

        events.push({
          id: `contract_expiry_${row.property_id}`,
          title: `Contrato expira: ${property?.title ?? row.property_id}`,
          category: 'contract_expiry',
          start_date: row.contract_expiry,
          all_day: true,
          color: CATEGORY_COLORS.contract_expiry,
          source: 'auto',
          is_recurring: false,
          is_overdue: isOverdue,
          property_id: row.property_id,
          property_title: property?.title ?? undefined,
          user_id: property?.consultant_id ?? undefined,
        })
      }
    }

    // ------ 3. Lead expiry ------
    if (leadExpiryRes.data) {
      for (const lead of leadExpiryRes.data) {
        const agent = lead.agent as { id: string; commercial_name: string } | null
        const isOverdue = lead.expires_at < now

        events.push({
          id: `lead_expiry_${lead.id}`,
          title: `Lead expira: ${lead.nome}`,
          category: 'lead_expiry',
          start_date: lead.expires_at,
          all_day: true,
          color: CATEGORY_COLORS.lead_expiry,
          source: 'auto',
          is_recurring: false,
          is_overdue: isOverdue,
          lead_id: lead.id,
          lead_name: lead.nome,
          user_id: agent?.id ?? undefined,
          user_name: agent?.commercial_name ?? undefined,
        })
      }
    }

    // ------ 4a. Process tasks ------
    if (procTasksRes.data) {
      for (const task of procTasksRes.data) {
        const proc = task.proc_instances as { id: string; external_ref: string; current_status: string; deleted_at: string | null; property_id: string; dev_properties: { id: string; title: string } | null } | null
        if (!proc) continue
        const property = proc.dev_properties
        const assignee = task.assignee as { id: string; commercial_name: string } | null

        events.push({
          id: `proc_task:${task.id}`,
          title: task.title,
          description: `${proc.external_ref} · ${task.stage_name ?? ''}${property ? ` · ${property.title}` : ''}`,
          category: 'process_task',
          start_date: task.due_date,
          all_day: true,
          color: CATEGORY_COLORS.process_task,
          source: 'auto',
          is_recurring: false,
          is_overdue: task.due_date < now,
          status: task.status,
          user_id: assignee?.id ?? undefined,
          user_name: assignee?.commercial_name ?? undefined,
          property_id: property?.id ?? undefined,
          property_title: property?.title ?? undefined,
          process_id: proc.id,
          process_ref: proc.external_ref,
          task_id: task.id,
          priority: task.priority ?? undefined,
          stage_name: task.stage_name ?? undefined,
        })
      }
    }

    // ------ 4b. Process subtasks ------
    if (procSubtasksRes.data) {
      for (const sub of procSubtasksRes.data) {
        const parentTask = sub.proc_tasks as { id: string; title: string; stage_name: string; proc_instance_id: string; proc_instances: { id: string; external_ref: string; current_status: string; deleted_at: string | null; property_id: string; dev_properties: { id: string; title: string } | null } | null } | null
        if (!parentTask?.proc_instances) continue
        const proc = parentTask.proc_instances
        const property = proc.dev_properties
        const assignee = sub.assignee as { id: string; commercial_name: string } | null
        const owner = sub.owners as { id: string; name: string } | null

        events.push({
          id: `proc_subtask:${sub.id}`,
          title: owner ? `${sub.title} (${owner.name})` : sub.title,
          description: `${proc.external_ref} · ${parentTask.stage_name ?? ''} · ${parentTask.title}${property ? ` · ${property.title}` : ''}`,
          category: 'process_subtask',
          start_date: sub.due_date,
          all_day: true,
          color: CATEGORY_COLORS.process_subtask,
          source: 'auto',
          is_recurring: false,
          is_overdue: sub.due_date < now,
          user_id: assignee?.id ?? undefined,
          user_name: assignee?.commercial_name ?? undefined,
          property_id: property?.id ?? undefined,
          property_title: property?.title ?? undefined,
          process_id: proc.id,
          process_ref: proc.external_ref,
          task_id: parentTask.id,
          subtask_id: sub.id,
          priority: sub.priority ?? undefined,
          stage_name: parentTask.stage_name ?? undefined,
        })
      }
    }

    // ------ Filter by categories ------
    let filtered = events
    if (requestedCategories && requestedCategories.length > 0) {
      filtered = events.filter((ev) => requestedCategories.includes(ev.category))
    }

    // ------ Filter by user_id ------
    if (userId) {
      filtered = filtered.filter((ev) => ev.user_id === userId)
    }

    // ------ Resolve WhatsApp chat_id for events from WhatsApp ------
    const wppMessageIds = filtered
      .filter((ev) => ev.wpp_message_id)
      .map((ev) => ev.wpp_message_id!)
    if (wppMessageIds.length > 0) {
      const { data: wppRows } = await admin
        .from('wpp_messages')
        .select('id, chat_id')
        .in('id', wppMessageIds)
      if (wppRows) {
        const chatMap = Object.fromEntries(wppRows.map((r: any) => [r.id, r.chat_id]))
        for (const ev of filtered) {
          if (ev.wpp_message_id && chatMap[ev.wpp_message_id]) {
            ev.wpp_chat_id = chatMap[ev.wpp_message_id]
          }
        }
      }
    }

    // ------ Sort by start_date ------
    filtered.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

    return NextResponse.json({ data: filtered, total: filtered.length })
  } catch (err) {
    console.error('[calendar/events GET]', err)
    return NextResponse.json(
      { error: 'Erro interno ao carregar eventos do calendário.' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// POST — Create a manual calendar event
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = calendarEventSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const admin = createAdminClient() as any

    const { data, error } = await admin
      .from('calendar_events')
      .insert({
        ...parsed.data,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('[calendar/events POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[calendar/events POST]', err)
    return NextResponse.json(
      { error: 'Erro interno ao criar evento.' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// Helpers — Recurring event occurrences
// ---------------------------------------------------------------------------

/** Get all yearly occurrences of a date that fall within [rangeStart, rangeEnd] */
function getYearlyOccurrences(originalDate: string, rangeStart: Date, rangeEnd: Date): Date[] {
  const orig = new Date(originalDate)
  const month = orig.getUTCMonth()
  const day = orig.getUTCDate()
  const hours = orig.getUTCHours()
  const minutes = orig.getUTCMinutes()
  const occurrences: Date[] = []

  for (let year = rangeStart.getFullYear(); year <= rangeEnd.getFullYear(); year++) {
    const occ = new Date(Date.UTC(year, month, day, hours, minutes))
    if (occ >= rangeStart && occ <= rangeEnd) {
      occurrences.push(occ)
    }
  }

  return occurrences
}

/** Get all monthly occurrences of a date that fall within [rangeStart, rangeEnd] */
function getMonthlyOccurrences(originalDate: string, rangeStart: Date, rangeEnd: Date): Date[] {
  const orig = new Date(originalDate)
  const day = orig.getUTCDate()
  const hours = orig.getUTCHours()
  const minutes = orig.getUTCMinutes()
  const occurrences: Date[] = []

  const cursor = new Date(Date.UTC(rangeStart.getFullYear(), rangeStart.getMonth(), day, hours, minutes))
  if (cursor < rangeStart) {
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  while (cursor <= rangeEnd) {
    occurrences.push(new Date(cursor))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return occurrences
}

/** Get all weekly occurrences of a date that fall within [rangeStart, rangeEnd] */
function getWeeklyOccurrences(originalDate: string, rangeStart: Date, rangeEnd: Date): Date[] {
  const orig = new Date(originalDate)
  const dayOfWeek = orig.getUTCDay()
  const hours = orig.getUTCHours()
  const minutes = orig.getUTCMinutes()
  const occurrences: Date[] = []

  // Find the first occurrence of that weekday on or after rangeStart
  const cursor = new Date(rangeStart)
  cursor.setUTCHours(hours, minutes, 0, 0)
  const cursorDay = cursor.getUTCDay()
  const diff = (dayOfWeek - cursorDay + 7) % 7
  cursor.setUTCDate(cursor.getUTCDate() + diff)

  while (cursor <= rangeEnd) {
    occurrences.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }

  return occurrences
}

/** Shift a date string to a specific year, keeping month/day/time */
function shiftDateToYear(dateStr: string, year: number): Date {
  const d = new Date(dateStr)
  d.setUTCFullYear(year)
  return d
}
