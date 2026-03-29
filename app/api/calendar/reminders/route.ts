import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET — Check for due reminders for the current user.
 * Returns events with reminders that should fire now (within a 5-min window).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const now = new Date()

    // Get user's role for visibility filtering
    const { data: userData } = await admin
      .from('dev_users')
      .select('id, user_roles:user_roles!user_roles_user_id_fkey(role_id, role:roles!user_roles_role_id_fkey(name))')
      .eq('id', user.id)
      .single()

    const userRoleName = (userData?.user_roles as any)?.[0]?.role?.name ?? ''

    // Get upcoming events (next 24h) with reminders
    const futureLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

    const { data: events, error } = await admin
      .from('calendar_events')
      .select('id, title, start_date, reminders, category, location, visibility, visibility_mode, visibility_user_ids, visibility_role_names, user_id')
      .not('reminders', 'eq', '[]')
      .gte('start_date', new Date(now.getTime() - 30 * 60 * 1000).toISOString())
      .lte('start_date', futureLimit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter events by visibility
    const visibleEvents = (events ?? []).filter((ev: any) => {
      // Simple visibility
      if (ev.visibility === 'private' && ev.user_id !== user.id) return false

      // Advanced visibility
      const mode = ev.visibility_mode ?? 'all'
      if (mode === 'all') return true

      const allowedUsers = ev.visibility_user_ids ?? []
      const allowedRoles = ev.visibility_role_names ?? []
      const userMatch = allowedUsers.includes(user.id)
      const roleMatch = allowedRoles.some((r: string) => r.toLowerCase() === userRoleName.toLowerCase())

      if (mode === 'include') return userMatch || roleMatch
      if (mode === 'exclude') return !userMatch && !roleMatch
      return true
    })

    // Check which reminders are due (within a 5-min window)
    const dueReminders: {
      event_id: string
      event_title: string
      event_start: string
      minutes_before: number
      location?: string
    }[] = []

    for (const event of visibleEvents) {
      const reminders = (event.reminders ?? []) as { minutes_before: number }[]
      const eventStart = new Date(event.start_date)

      for (const reminder of reminders) {
        const reminderTime = new Date(eventStart.getTime() - reminder.minutes_before * 60 * 1000)
        const diffMs = now.getTime() - reminderTime.getTime()

        // Due if within a 5-minute window (0 to 5 min after reminder time)
        if (diffMs >= 0 && diffMs <= 5 * 60 * 1000) {
          dueReminders.push({
            event_id: event.id,
            event_title: event.title,
            event_start: event.start_date,
            minutes_before: reminder.minutes_before,
            location: event.location ?? undefined,
          })
        }
      }
    }

    return NextResponse.json({ reminders: dueReminders })
  } catch (err) {
    console.error('[calendar/reminders GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
