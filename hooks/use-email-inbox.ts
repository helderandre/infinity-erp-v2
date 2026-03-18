import { useState, useEffect, useCallback } from 'react'
import type { ImapMessageEnvelope } from '@/types/email'

interface EmailFolder {
  name: string
  path: string
  flags: string[]
  delimiter: string
  special?: string
}

interface InboxState {
  messages: ImapMessageEnvelope[]
  total: number
  page: number
  limit: number
  folder: string
  isLoading: boolean
  error: string | null
}

export function useEmailInbox(initialFolder = 'INBOX') {
  const [state, setState] = useState<InboxState>({
    messages: [],
    total: 0,
    page: 1,
    limit: 50,
    folder: initialFolder,
    isLoading: true,
    error: null,
  })

  const [folders, setFolders] = useState<EmailFolder[]>([])
  const [foldersLoading, setFoldersLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const fetchMessages = useCallback(
    async (folder: string, page: number, limit = 50) => {
      setState((s) => ({ ...s, isLoading: true, error: null }))
      try {
        const params = new URLSearchParams({
          action: 'list',
          folder,
          page: String(page),
          limit: String(limit),
        })
        const res = await fetch(`/api/email/inbox?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar mensagens')
        setState((s) => ({
          ...s,
          messages: data.messages,
          total: data.total,
          page: data.page,
          limit: data.limit,
          folder: data.folder,
          isLoading: false,
        }))
      } catch (err) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        }))
      }
    },
    []
  )

  const fetchFolders = useCallback(async () => {
    setFoldersLoading(true)
    try {
      const res = await fetch('/api/email/inbox?action=folders')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFolders(data.folders || [])
    } catch {
      // Silently fail — folders are optional UI
    } finally {
      setFoldersLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMessages(state.folder, 1)
    fetchFolders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changeFolder = useCallback(
    (folder: string) => {
      fetchMessages(folder, 1)
    },
    [fetchMessages]
  )

  const changePage = useCallback(
    (page: number) => {
      fetchMessages(state.folder, page)
    },
    [fetchMessages, state.folder]
  )

  const refresh = useCallback(() => {
    fetchMessages(state.folder, state.page)
  }, [fetchMessages, state.folder, state.page])

  const markRead = useCallback(
    async (uid: number) => {
      try {
        await fetch('/api/email/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_read', uid, folder: state.folder }),
        })
        // Update local state
        setState((s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.uid === uid ? { ...m, flags: [...m.flags.filter((f) => f !== '\\Seen'), '\\Seen'] } : m
          ),
        }))
      } catch {
        // Silent
      }
    },
    [state.folder]
  )

  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchQuery('')
        setIsSearching(false)
        fetchMessages(state.folder, 1)
        return
      }
      setSearchQuery(query)
      setIsSearching(true)
      setState((s) => ({ ...s, isLoading: true, error: null }))
      try {
        const params = new URLSearchParams({
          action: 'search',
          folder: state.folder,
          query,
          limit: String(state.limit),
        })
        const res = await fetch(`/api/email/inbox?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro na pesquisa')
        setState((s) => ({
          ...s,
          messages: data.messages,
          total: data.total,
          page: 1,
          isLoading: false,
        }))
      } catch (err) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        }))
      }
    },
    [state.folder, state.limit, fetchMessages]
  )

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setIsSearching(false)
    fetchMessages(state.folder, 1)
  }, [fetchMessages, state.folder])

  const toggleFlag = useCallback(
    async (uid: number, flagged: boolean) => {
      try {
        await fetch('/api/email/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle_flagged', uid, folder: state.folder, flagged }),
        })
        setState((s) => ({
          ...s,
          messages: s.messages.map((m) => {
            if (m.uid !== uid) return m
            const flags = flagged
              ? [...m.flags.filter((f) => f !== '\\Flagged'), '\\Flagged']
              : m.flags.filter((f) => f !== '\\Flagged')
            return { ...m, flags }
          }),
        }))
      } catch {
        // Silent
      }
    },
    [state.folder]
  )

  const moveToFolder = useCallback(
    async (uid: number, destination: string) => {
      try {
        const res = await fetch('/api/email/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'move', uid, folder: state.folder, destination }),
        })
        if (!res.ok) throw new Error('Erro ao mover mensagem')
        // Remove from current list
        setState((s) => ({
          ...s,
          messages: s.messages.filter((m) => m.uid !== uid),
          total: Math.max(0, s.total - 1),
        }))
        return true
      } catch {
        return false
      }
    },
    [state.folder]
  )

  const deleteMessage = useCallback(
    async (uid: number) => {
      try {
        const res = await fetch('/api/email/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', uid, folder: state.folder }),
        })
        if (!res.ok) throw new Error('Erro ao eliminar mensagem')
        setState((s) => ({
          ...s,
          messages: s.messages.filter((m) => m.uid !== uid),
          total: Math.max(0, s.total - 1),
        }))
        return true
      } catch {
        return false
      }
    },
    [state.folder]
  )

  const archiveMessage = useCallback(
    async (uid: number) => {
      try {
        const res = await fetch('/api/email/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'archive', uid, folder: state.folder }),
        })
        if (!res.ok) throw new Error('Erro ao arquivar mensagem')
        setState((s) => ({
          ...s,
          messages: s.messages.filter((m) => m.uid !== uid),
          total: Math.max(0, s.total - 1),
        }))
        return true
      } catch {
        return false
      }
    },
    [state.folder]
  )

  return {
    ...state,
    folders,
    foldersLoading,
    searchQuery,
    isSearching,
    changeFolder,
    changePage,
    refresh,
    markRead,
    toggleFlag,
    moveToFolder,
    deleteMessage,
    archiveMessage,
    search,
    clearSearch,
  }
}

export interface FullMessage {
  uid: number
  folder: string
  messageId: string | null
  inReplyTo: string | null
  references: string[]
  from: { name?: string; address?: string }[]
  to: { name?: string; address?: string }[]
  cc: { name?: string; address?: string }[]
  subject: string
  date: string | null
  html: string | null
  text: string | null
  flags: string[]
  isRead: boolean
  isFlagged: boolean
  attachments: {
    filename: string
    content_type: string
    size_bytes: number
    cid: string | null
    is_inline: boolean
    data_base64: string
  }[]
}

export function useEmailMessage(uid: number | null, folder = 'INBOX') {
  const [message, setMessage] = useState<FullMessage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      setMessage(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(`/api/email/inbox/${uid}?folder=${encodeURIComponent(folder)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        if (!cancelled) setMessage(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [uid, folder])

  return { message, isLoading, error }
}
