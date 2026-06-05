'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, X, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ProcessChat } from './process-chat'
import { createClient } from '@/lib/supabase/client'

interface FloatingChatProps {
  processId: string
  currentUser: { id: string; name: string; avatarUrl?: string }
  onEntityClick?: (entityType: string, entityId: string) => void
}

export function FloatingChat({ processId, currentUser, onEntityClick }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [mounted, setMounted] = useState(false)

  // Mount flag so we only render the portal client-side
  useEffect(() => {
    setMounted(true)
  }, [])

  // Track unread messages when chat is closed
  useEffect(() => {
    if (isOpen) return

    const supabase = createClient()
    const channel = supabase
      .channel(`floating-chat-${processId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proc_chat_messages',
          filter: `proc_instance_id=eq.${processId}`,
        },
        (payload) => {
          if (payload.new && (payload.new as { sender_id: string }).sender_id !== currentUser.id) {
            setUnreadCount((prev) => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, processId, currentUser.id])

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) setUnreadCount(0)
      return !prev
    })
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  if (!mounted) return null

  const overlay = (
    <>
      {/* Chat Panel */}
      <div
        className={cn(
          'fixed bottom-24 right-4 left-4 z-50 sm:left-auto sm:w-[600px] sm:right-6 sm:bottom-24 rounded-2xl border bg-background shadow-2xl transition-all duration-300 ease-out',
          isOpen
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
        )}
        style={{ height: 'min(700px, calc(100vh - 140px))' }}
      >
        {/* Custom header with close/minimize */}
        <div className="flex items-center justify-between border-b px-4 py-2.5 rounded-t-2xl bg-muted/30">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Chat do Processo</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleClose}
            title="Minimizar"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>

        {/* Chat content - only render when open to avoid unnecessary subscriptions */}
        {isOpen && (
          <div className="h-[calc(100%-45px)]">
            <ProcessChat
              processId={processId}
              currentUser={currentUser}
              hideHeader
              onEntityClick={onEntityClick}
            />
          </div>
        )}
      </div>

      {/* Floating Button */}
      <button
        onClick={handleToggle}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95',
          'h-14 w-14 bg-primary text-primary-foreground hover:bg-primary/90',
          isOpen && 'bg-muted text-muted-foreground hover:bg-muted/90'
        )}
        title={isOpen ? 'Fechar chat' : 'Abrir chat'}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <div className="relative">
            <MessageSquare className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-2.5 -right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        )}
      </button>
    </>
  )

  return createPortal(overlay, document.body)
}
