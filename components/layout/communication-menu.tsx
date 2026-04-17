'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { comunicacaoItems } from './app-sidebar'

export function CommunicationMenu() {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchUnread() {
      // Sum all unread_count from non-archived chats across all instances
      const { data, error } = await (supabase as any)
        .from('wpp_chats')
        .select('unread_count')
        .eq('is_archived', false)
        .gt('unread_count', 0)

      if (!error && data) {
        const total = data.reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0)
        setUnreadCount(total)
      }
    }

    fetchUnread()

    // Subscribe to realtime changes on wpp_chats
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
  }, [])

  return (
    <DropdownMenu>
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
