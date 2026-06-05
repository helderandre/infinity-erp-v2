import { useState, useEffect, useCallback, useRef } from 'react'
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

export function useEmailInbox(accountId: string | null, initialFolder = 'INBOX') {
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

  // Track accountId to reset state on change
  const prevAccountIdRef = useRef(accountId)

  const buildParams = useCallback(
    (extra: Record<string, string>) => {
      const params = new URLSearchParams(extra)
      if (accountId) params.set('account_id', accountId)
      return params
    },
    [accountId]
  )

  const fetchMessages = useCallback(
    async (folder: string, page: number, limit = 50) => {
      if (!accountId) return
      setState((s) => ({ ...s, isLoading: true, error: null }))
      try {
        const params = buildParams({
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
    [accountId, buildParams]
  )

  const fetchFolders = useCallback(async () => {
    if (!accountId) return
    setFoldersLoading(true)
    try {
      const params = buildParams({ action: 'folders' })
      const res = await fetch(`/api/email/inbox?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFolders(data.folders || [])
    } catch {
      // Silently fail — folders are optional UI
    } finally {
      setFoldersLoading(false)
    }
  }, [accountId, buildParams])

  // Fetch on mount and when accountId changes
  useEffect(() => {
    if (!accountId) {
      setState((s) => ({ ...s, messages: [], total: 0, isLoading: false }))
      setFolders([])
      return
    }

    // Reset to INBOX when switching accounts
    if (prevAccountIdRef.current !== accountId) {
      prevAccountIdRef.current = accountId
      setState((s) => ({ ...s, folder: 'INBOX', page: 1 }))
      setSearchQuery('')
      setIsSearching(false)
    }

    fetchMessages('INBOX', 1)
    fetchFolders()
  }, [accountId, fetchMessages, fetchFolders])

  const changeFolder = useCallback(
    (folder: string) => {
      setSearchQuery('')
      setIsSearching(false)
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

  const postAction = useCallback(
    async (body: Record<string, unknown>) => {
      return fetch('/api/email/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, account_id: accountId }),
      })
    },
    [accountId]
  )

  const markRead = useCallback(
    async (uid: number) => {
      try {
        await postAction({ action: 'mark_read', uid, folder: state.folder })
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
    [state.folder, postAction]
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
        const params = buildParams({
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
    [state.folder, state.limit, fetchMessages, buildParams]
  )

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setIsSearching(false)
    fetchMessages(state.folder, 1)
  }, [fetchMessages, state.folder])

  const toggleFlag = useCallback(
    async (uid: number, flagged: boolean) => {
      try {
        await postAction({ action: 'toggle_flagged', uid, folder: state.folder, flagged })
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
    [state.folder, postAction]
  )

  const moveToFolder = useCallback(
    async (uid: number, destination: string) => {
      try {
        const res = await postAction({ action: 'move', uid, folder: state.folder, destination })
        if (!res.ok) throw new Error('Erro ao mover mensagem')
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
    [state.folder, postAction]
  )

  const deleteMessage = useCallback(
    async (uid: number) => {
      try {
        const res = await postAction({ action: 'delete', uid, folder: state.folder })
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
    [state.folder, postAction]
  )

  const archiveMessage = useCallback(
    async (uid: number) => {
      try {
        const res = await postAction({ action: 'archive', uid, folder: state.folder })
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
    [state.folder, postAction]
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

export function useEmailMessage(uid: number | null, folder = 'INBOX', accountId?: string | null) {
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

    const params = new URLSearchParams({ folder })
    if (accountId) params.set('account_id', accountId)

    fetch(`/api/email/inbox/${uid}?${params}`)
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
  }, [uid, folder, accountId])

  return { message, isLoading, error }
}
