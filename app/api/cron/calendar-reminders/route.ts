import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/crm/send-push'
import { NotificationService } from '@/lib/notifications/service'

/**
 * Cron endpoint — runs every 1-2 minutes via Coolify/external cron.
 * Checks for due calendar reminders and sends push notifications.
 *
 * Call: GET /api/cron/calendar-reminders?key=<CRON_SECRET>
 */
export async function GET(request: Request) {
  try {
    // Simple auth — check cron secret
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && key !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const now = new Date()

    // 1. Get events with reminders starting in the next 24h
    const futureLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

    const { data: events, error } = await admin
      .from('calendar_events')
      .select('id, title, start_date, reminders, category, location, visibility, visibility_mode, visibility_user_ids, visibility_role_names, user_id, created_by')
      .not('reminders', 'eq', '[]')
      .gte('start_date', now.toISOString())
      .lte('start_date', futureLimit)

    if (error || !events?.length) {
      return NextResponse.json({ sent: 0, checked: events?.length ?? 0 })
    }

    // 2. Find due reminders (within a 2-min window to match cron interval)
    const WINDOW_MS = 2 * 60 * 1000

    type DueReminder = {
      event_id: string
      event_title: string
      event_start: string
      minutes_before: number
      location?: string
      visibility: string
      visibility_mode: string
      visibility_user_ids: string[]
      visibility_role_names: string[]
      user_id?: string
    }

    const dueReminders: DueReminder[] = []

    for (const ev of events) {
      const reminders = (ev.reminders ?? []) as { minutes_before: number }[]
      const eventStart = new Date(ev.start_date)

      for (const reminder of reminders) {
        const reminderTime = new Date(eventStart.getTime() - reminder.minutes_before * 60 * 1000)
        const diffMs = now.getTime() - reminderTime.getTime()

        if (diffMs >= 0 && diffMs <= WINDOW_MS) {
          dueReminders.push({
            event_id: ev.id,
            event_title: ev.title,
            event_start: ev.start_date,
            minutes_before: reminder.minutes_before,
            location: ev.location ?? undefined,
            visibility: ev.visibility ?? 'all',
            visibility_mode: ev.visibility_mode ?? 'all',
            visibility_user_ids: ev.visibility_user_ids ?? [],
            visibility_role_names: ev.visibility_role_names ?? [],
            user_id: ev.user_id ?? undefined,
          })
        }
      }
    }

    if (dueReminders.length === 0) {
      return NextResponse.json({ sent: 0, due: 0 })
    }

    // 3. Get all active users with their roles
    const { data: allUsers } = await admin
      .from('dev_users')
      .select('id, user_roles:user_roles!user_roles_user_id_fkey(role:roles!user_roles_role_id_fkey(name))')
      .eq('is_active', true)

    if (!allUsers?.length) {
      return NextResponse.json({ sent: 0, due: dueReminders.length, users: 0 })
    }

    const usersWithRoles = allUsers.map((u: any) => ({
      id: u.id,
      roleName: (u.user_roles as any)?.[0]?.role?.name ?? '',
    }))

    // 4. For each due reminder, determine target users and send push
    let totalSent = 0

    for (const reminder of dueReminders) {
      // Determine who should receive this notification
      let targetUserIds: string[]

      if (reminder.visibility === 'private') {
        // Only the event creator/assigned user
        targetUserIds = reminder.user_id ? [reminder.user_id] : []
      } else if (reminder.visibility_mode === 'all') {
        // Everyone
        targetUserIds = usersWithRoles.map((u: any) => u.id)
      } else if (reminder.visibility_mode === 'include') {
        // Only listed users/roles
        targetUserIds = usersWithRoles
          .filter((u: any) =>
            reminder.visibility_user_ids.includes(u.id) ||
            reminder.visibility_role_names.some((r: string) => r.toLowerCase() === u.roleName.toLowerCase())
          )
          .map((u: any) => u.id)
      } else if (reminder.visibility_mode === 'exclude') {
        // Everyone except listed
        targetUserIds = usersWithRoles
          .filter((u: any) =>
            !reminder.visibility_user_ids.includes(u.id) &&
            !reminder.visibility_role_names.some((r: string) => r.toLowerCase() === u.roleName.toLowerCase())
          )
          .map((u: any) => u.id)
      } else {
        targetUserIds = usersWithRoles.map((u: any) => u.id)
      }

      // Format the notification
      const formatMin = (m: number) => {
        if (m < 60) return `${m} minutos`
        if (m === 60) return '1 hora'
        if (m < 1440) return `${Math.round(m / 60)} horas`
        return '1 dia'
      }

      const locationStr = reminder.location ? ` · ${reminder.location}` : ''
      const payload = {
        title: `🔔 ${reminder.event_title}`,
        body: `Começa em ${formatMin(reminder.minutes_before)}${locationStr}`,
        url: '/dashboard/calendario',
        tag: `cal-reminder-${reminder.event_id}-${reminder.minutes_before}`,
      }

      // Send push + create bell notification for each target user
      const notifService = new NotificationService()

      for (const userId of targetUserIds) {
        // Push notification
        const sent = await sendPushToUser(admin, userId, payload)
        totalSent += sent

        // Bell notification (persistent, shows in notification popover)
        await notifService.create({
          recipientId: userId,
          notificationType: 'calendar_reminder',
          entityType: 'proc_instance', // reuse existing type for compatibility
          entityId: reminder.event_id,
          title: `🔔 ${reminder.event_title}`,
          body: `Começa em ${formatMin(reminder.minutes_before)}${locationStr}`,
          actionUrl: '/dashboard/calendario',
          metadata: {
            event_id: reminder.event_id,
            minutes_before: reminder.minutes_before,
          },
        })
      }
    }

    return NextResponse.json({
      sent: totalSent,
      due: dueReminders.length,
      timestamp: now.toISOString(),
    })
  } catch (err) {
    console.error('[cron/calendar-reminders]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
