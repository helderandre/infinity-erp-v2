'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { FullMessage } from '@/hooks/use-email-inbox'

export type ComposerMode = 'normal' | 'minimized' | 'fullscreen'

export interface OpenComposerArgs {
  replyTo?: FullMessage | null
  forwardMessage?: FullMessage | null
  accountId?: string | null
  senderEmail?: string
  senderName?: string
  initialTo?: string
  initialCc?: string
  initialSubject?: string
  /** Pre-filled body HTML (e.g. when switching from the advanced template editor). */
  initialBodyHtml?: string
  /** Suppress auto-appending the signature block — the initial body already contains it. */
  omitSignature?: boolean
  onSent?: () => void
}

export interface ComposerDraft extends OpenComposerArgs {
  uid: string
  mode: ComposerMode
}

interface ComposerContextValue {
  drafts: ComposerDraft[]
  openComposer: (args?: OpenComposerArgs) => void
  closeComposer: (uid: string) => void
  setDraftMode: (uid: string, mode: ComposerMode) => void
}

const ComposerContext = createContext<ComposerContextValue | null>(null)

/** Soft cap — prevents the stack from growing unbounded if a user spams "Novo email". */
const MAX_DRAFTS = 3

export function EmailComposerProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<ComposerDraft[]>([])

  const openComposer = useCallback((args: OpenComposerArgs = {}) => {
    setDrafts((prev) => {
      const next: ComposerDraft = { ...args, uid: crypto.randomUUID(), mode: 'normal' }
      // Demote any existing fullscreen draft so the new one is visible.
      const normalised = prev.map((d) =>
        d.mode === 'fullscreen' ? { ...d, mode: 'normal' as const } : d
      )
      const combined = [...normalised, next]
      // Enforce soft cap — drop the oldest when exceeded (its autosave already ran).
      return combined.slice(-MAX_DRAFTS)
    })
  }, [])

  const closeComposer = useCallback((uid: string) => {
    setDrafts((prev) => prev.filter((d) => d.uid !== uid))
  }, [])

  const setDraftMode = useCallback((uid: string, mode: ComposerMode) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.uid === uid) return { ...d, mode }
        // Only one fullscreen at a time — demote any other fullscreen draft.
        if (mode === 'fullscreen' && d.mode === 'fullscreen') {
          return { ...d, mode: 'normal' }
        }
        return d
      })
    )
  }, [])

  const value = useMemo<ComposerContextValue>(
    () => ({ drafts, openComposer, closeComposer, setDraftMode }),
    [drafts, openComposer, closeComposer, setDraftMode]
  )

  return (
    <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>
  )
}

export function useEmailComposer() {
  const ctx = useContext(ComposerContext)
  if (!ctx) {
    throw new Error('useEmailComposer must be used within EmailComposerProvider')
  }
  return ctx
}
