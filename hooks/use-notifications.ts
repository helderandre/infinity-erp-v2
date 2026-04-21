'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { showNotificationToast } from '@/components/notifications/notification-toast'
import {
  PROCESS_ENTITY_TYPES,
  classifyBucket,
  type Notification,
  type NotificationBucket,
} from '@/lib/notifications/types'

// CRM lead notifications have a slightly different shape — normalize to unified format
interface CrmNotification {
  id: string
  recipient_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
  entry_id?: string | null
  contact_id?: string | null
}

function normalizeCrmNotification(n: CrmNotification): Notification {
  return {
    id: `crm_${n.id}`,
    recipient_id: n.recipient_id,
    sender_id: null,
    notification_type: n.type as Notification['notification_type'],
    entity_type: 'lead' as const,
    entity_id: n.contact_id ?? n.entry_id ?? n.id,
    title: n.title,
    body: n.body,
    action_url: n.link ?? '/dashboard/crm',
    is_read: n.is_read,
    read_at: n.read_at,
    metadata: { source: 'crm', entry_id: n.entry_id, contact_id: n.contact_id },
    created_at: n.created_at,
  }
}

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const crmChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      // Fetch both process + CRM notifications in parallel
      const [procRes, crmRes] = await Promise.all([
        fetch('/api/notifications?limit=50'),
        fetch('/api/crm/notifications?limit=50'),
      ])

      let procNotifs: Notification[] = []
      let procUnread = 0
      if (procRes.ok) {
        const data = await procRes.json()
        procNotifs = data.notifications ?? []
        procUnread = data.unread_count ?? 0
      }

      let crmNotifs: Notification[] = []
      let crmUnread = 0
      if (crmRes.ok) {
        const data = await crmRes.json()
        crmNotifs = (data.notifications ?? []).map(normalizeCrmNotification)
        crmUnread = data.unread_count ?? 0
      }

      // Merge and sort by created_at DESC
      const merged = [...procNotifs, ...crmNotifs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setNotifications(merged)
      setUnreadCount(procUnread + crmUnread)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return
    const [procRes, crmRes] = await Promise.all([
      fetch('/api/notifications/unread-count'),
      fetch('/api/crm/notifications?unread_only=true&limit=1'),
    ])
    let total = 0
    if (procRes.ok) {
      const { count } = await procRes.json()
      total += count ?? 0
    }
    if (crmRes.ok) {
      const { unread_count } = await crmRes.json()
      total += unread_count ?? 0
    }
    setUnreadCount(total)
  }, [userId])

  // Subscricao Realtime — process notifications
  useEffect(() => {
    if (!userId) return

    fetchNotifications()

    const supabase = createClient()

    // Process notifications channel
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        const newNotif = payload.new as Notification
        setNotifications(prev => {
          if (prev.find(n => n.id === newNotif.id)) return prev
          return [newNotif, ...prev]
        })
        setUnreadCount(prev => prev + 1)
        showNotificationToast(newNotif)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, () => {
        fetchUnreadCount()
      })
      .subscribe()

    channelRef.current = channel

    // CRM lead notifications channel
    const crmChannel = supabase
      .channel(`crm-notifications-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leads_notifications',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        const raw = payload.new as CrmNotification
        const normalized = normalizeCrmNotification(raw)
        setNotifications(prev => {
          if (prev.find(n => n.id === normalized.id)) return prev
          return [normalized, ...prev]
        })
        setUnreadCount(prev => prev + 1)
        showNotificationToast(normalized)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'leads_notifications',
        filter: `recipient_id=eq.${userId}`,
      }, () => {
        fetchUnreadCount()
      })
      .subscribe()

    crmChannelRef.current = crmChannel

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(crmChannel)
      channelRef.current = null
      crmChannelRef.current = null
    }
  }, [userId, fetchNotifications, fetchUnreadCount])

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    // Route to correct API based on ID prefix
    if (notificationId.startsWith('crm_')) {
      const realId = notificationId.replace('crm_', '')
      await fetch('/api/crm/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [realId] }),
      })
    } else {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      })
    }
  }, [])

  const markAllAsRead = useCallback(async (options?: { scope?: NotificationBucket }) => {
    const scope = options?.scope
    const now = new Date().toISOString()
    const shouldTouch = (n: Notification) => {
      if (!scope) return !n.is_read
      return !n.is_read && classifyBucket(n.entity_type) === scope
    }

    const snapshot: Array<{ id: string; read_at: string | null }> = []
    setNotifications(prev => prev.map(n => {
      if (!shouldTouch(n)) return n
      snapshot.push({ id: n.id, read_at: n.read_at })
      return { ...n, is_read: true, read_at: now }
    }))
    setUnreadCount(prev => Math.max(0, prev - snapshot.length))

    try {
      const tasks: Promise<Response>[] = []

      if (scope === 'processo') {
        tasks.push(
          fetch('/api/notifications', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_types: [...PROCESS_ENTITY_TYPES] }),
          }),
        )
      } else if (scope === 'geral') {
        tasks.push(
          fetch('/api/notifications', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exclude_entity_types: [...PROCESS_ENTITY_TYPES] }),
          }),
          fetch('/api/crm/notifications', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ all: true }),
          }),
        )
      } else {
        tasks.push(
          fetch('/api/notifications', { method: 'PUT' }),
          fetch('/api/crm/notifications', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ all: true }),
          }),
        )
      }

      const results = await Promise.all(tasks)
      if (results.some(r => !r.ok)) throw new Error('mark_all_failed')
    } catch {
      const touched = new Map(snapshot.map(s => [s.id, s.read_at]))
      setNotifications(prev => prev.map(n => (
        touched.has(n.id)
          ? { ...n, is_read: false, read_at: touched.get(n.id) ?? null }
          : n
      )))
      setUnreadCount(prev => prev + snapshot.length)
    }
  }, [])

  const deleteNotification = useCallback(async (notificationId: string) => {
    const notif = notifications.find(n => n.id === notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    if (notif && !notif.is_read) setUnreadCount(prev => Math.max(0, prev - 1))

    if (!notificationId.startsWith('crm_')) {
      await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' })
    }
    // CRM notifications don't have a delete endpoint — just hide client-side
  }, [notifications])

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  }
}
