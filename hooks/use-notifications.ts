'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { showNotificationToast } from '@/components/notifications/notification-toast'
import type { Notification } from '@/lib/notifications/types'

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=50')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return
    const res = await fetch('/api/notifications/unread-count')
    if (res.ok) {
      const { count } = await res.json()
      setUnreadCount(count)
    }
  }, [userId])

  // Subscricao Realtime
  useEffect(() => {
    if (!userId) return

    fetchNotifications()

    const supabase = createClient()
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
        // Mostrar toast em tempo real
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

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, fetchNotifications, fetchUnreadCount])

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
    await fetch(`/api/notifications/${notificationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    })
  }, [])

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
    setUnreadCount(0)
    await fetch('/api/notifications', { method: 'PUT' })
  }, [])

  const deleteNotification = useCallback(async (notificationId: string) => {
    const notif = notifications.find(n => n.id === notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    if (notif && !notif.is_read) setUnreadCount(prev => Math.max(0, prev - 1))
    await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' })
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
