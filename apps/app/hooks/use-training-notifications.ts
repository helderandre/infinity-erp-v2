'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TrainingNotification } from '@/types/training'

interface UseTrainingNotificationsReturn {
  notifications: TrainingNotification[]
  unreadCount: number
  isLoading: boolean
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  refetch: () => void
}

export function useTrainingNotifications(): UseTrainingNotificationsReturn {
  const [notifications, setNotifications] = useState<TrainingNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/training/notifications')
      if (!res.ok) throw new Error('Erro ao carregar notificações')
      const data = await res.json()
      setNotifications(data.data || [])
      setUnreadCount(data.unread_count || 0)
    } catch (err) {
      console.error('Erro ao carregar notificações:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/training/notifications/${id}/read`, { method: 'PUT' })
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Erro ao marcar como lida:', err)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch('/api/training/notifications/read-all', { method: 'PUT' })
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err)
    }
  }, [])

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refetch: fetchNotifications }
}
