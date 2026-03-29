'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const POLL_INTERVAL = 60_000 // Check every minute
const SHOWN_KEY = 'calendar_reminders_shown'

function getShownReminders(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SHOWN_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function markReminderShown(key: string) {
  const shown = getShownReminders()
  shown.add(key)
  sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...shown]))
}

function formatMinutesBefore(min: number): string {
  if (min < 60) return `${min} minutos`
  if (min === 60) return '1 hora'
  if (min < 1440) return `${Math.round(min / 60)} horas`
  return '1 dia'
}

async function sendPushNotification(title: string, body: string, url?: string) {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    reg.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `cal-reminder-${Date.now()}`,
      data: { url: url || `/dashboard/calendario?event=${reminder.event_id}` },
    })
  } catch {
    // silently fail
  }
}

export function useCalendarReminders() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const checkReminders = async () => {
      try {
        const res = await fetch('/api/calendar/reminders')
        if (!res.ok) return
        const { reminders } = await res.json()
        if (!reminders?.length) return

        const shown = getShownReminders()

        for (const reminder of reminders) {
          const key = `${reminder.event_id}_${reminder.minutes_before}`
          if (shown.has(key)) continue

          markReminderShown(key)

          const timeLabel = formatMinutesBefore(reminder.minutes_before)
          const locationStr = reminder.location ? ` · ${reminder.location}` : ''

          // In-app toast
          toast(`🔔 ${reminder.event_title}`, {
            description: `Começa em ${timeLabel}${locationStr}`,
            duration: 15000,
          })

          // Push notification (for when tab is in background)
          sendPushNotification(
            `🔔 ${reminder.event_title}`,
            `Começa em ${timeLabel}${locationStr}`,
            `/dashboard/calendario?event=${reminder.event_id}`
          )
        }
      } catch {
        // silently fail
      }
    }

    // Check immediately
    checkReminders()

    // Then poll every minute
    intervalRef.current = setInterval(checkReminders, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])
}
