'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { comunicacaoItems } from './app-sidebar'

/**
 * Last-seen timestamp (stored in localStorage) is the WhatsApp
 * `last_message_timestamp` watermark the user has acknowledged. Only chats
 * whose newest message is strictly newer than this watermark contribute to
 * the badge — so the backlog doesn't re-appear on every app reload.
 *
 * The watermark advances when the user:
 *  - opens the communication dropdown, or
 *  - visits the /dashboard/whatsapp page.
 */
const STORAGE_KEY = 'wpp.notifications.seen_at'
// Dedupe the per-session whole-app sync across tabs and re-mounts
const SESSION_SYNC_KEY = 'wpp.session_sync_at'
const SESSION_SYNC_WINDOW_MS = 5 * 60 * 1000 // 5 min

function readSeenAt(): number {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) ? n : 0
}

function writeSeenAt(ts: number) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, String(ts))
}

export function CommunicationMenu() {
  const router = useRouter()
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null)
  const latestTsRef = useRef(0) // highest last_message_timestamp seen in the current list

  const fetchUnread = useCallback(async () => {
    const supabase = createClient()
    const seenAt = readSeenAt()

    // Fetch chats with unread messages and their last_message_timestamp.
    // Only count chats whose latest message is newer than the watermark.
    const { data, error } = await (supabase as any)
      .from('wpp_chats')
      .select('unread_count, last_message_timestamp')
      .eq('is_archived', false)
      .gt('unread_count', 0)

    if (error || !data) {
      setUnreadCount(0)
      return
    }

    let total = 0
    let maxTs = 0
    for (const c of data as Array<{ unread_count: number; last_message_timestamp: number | null }>) {
      const ts = Number(c.last_message_timestamp) || 0
      if (ts > maxTs) maxTs = ts
      if (ts > seenAt) total += c.unread_count || 0
    }
    latestTsRef.current = maxTs
    setUnreadCount(total)
  }, [])

  useEffect(() => {
    fetchUnread()

    const supabase = createClient()
    const channel = supabase
      .channel('wpp-chats-unread-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wpp_chats' },
        () => { fetchUnread() }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [fetchUnread])

  // Clear the badge when the user opens the WhatsApp page
  useEffect(() => {
    if (pathname?.startsWith('/dashboard/whatsapp')) {
      const ts = Math.max(latestTsRef.current, Math.floor(Date.now() / 1000))
      writeSeenAt(ts)
      setUnreadCount(0)
    }
  }, [pathname])

  // Dismiss when opening the dropdown (agent has acknowledged the notifications)
  const handleOpenChange = (open: boolean) => {
    if (open && unreadCount > 0) {
      const ts = Math.max(latestTsRef.current, Math.floor(Date.now() / 1000))
      writeSeenAt(ts)
      setUnreadCount(0)
    }
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-muted/50 transition-colors"
        >
          <MessageCircle className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-medium text-background">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Comunicação</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {comunicacaoItems.map((item) => (
          <DropdownMenuItem
            key={item.href}
            onClick={() => router.push(item.href)}
          >
            <item.icon className="mr-2 h-4 w-4" />
            <span className="flex-1">{item.title}</span>
            {item.title === 'WhatsApp' && unreadCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-medium text-background">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
