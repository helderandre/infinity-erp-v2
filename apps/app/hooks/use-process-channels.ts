'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ProcessChannelPreview } from '@/types/internal-chat'

export function useProcessChannels() {
  const [channels, setChannels] = useState<ProcessChannelPreview[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const initialLoadRef = useRef(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchChannels = useCallback(async (query?: string) => {
    try {
      const params = new URLSearchParams()
      if (query) params.set('search', query)
      const res = await fetch(`/api/chat/process-channels?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar canais')
      const data = await res.json()
      setChannels(data)
    } catch {
      // silently fail
    }
  }, [])

  const fetchWithLoading = useCallback(async (query?: string) => {
    setIsLoading(true)
    await fetchChannels(query)
    setIsLoading(false)
  }, [fetchChannels])

  // Initial load
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false
      fetchWithLoading()
    }
  }, [fetchWithLoading])

  // Poll every 30s for unread updates
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchChannels(search || undefined)
    }, 30000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchChannels, search])

  // Search with debounce handled by caller
  const searchChannels = useCallback((query: string) => {
    setSearch(query)
    fetchChannels(query || undefined)
  }, [fetchChannels])

  return {
    channels,
    isLoading,
    search,
    searchChannels,
    refetch: () => fetchChannels(search || undefined),
  }
}
