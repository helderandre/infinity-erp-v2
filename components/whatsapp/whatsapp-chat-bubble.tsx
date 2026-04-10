'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, Minus, ExternalLink, MessageSquareWarning } from 'lucide-react'
import { isToday, isYesterday, format, isSameDay } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useWhatsAppMessages } from '@/hooks/use-whatsapp-messages'
import { useWhatsAppPresence } from '@/hooks/use-whatsapp-presence'
import { MessageBubble } from './message-bubble'
import { ChatInput } from './chat-input'
import { TypingIndicator } from './typing-indicator'
import type { WppMessage } from '@/lib/types/whatsapp-web'

interface WhatsAppChatBubbleProps {
  contactPhone: string | null
  contactName: string
}

interface ResolvedChat {
  found: boolean
  chat_id?: string
  instance_id?: string
  profile_pic_url?: string
  reason?: string
}

function formatDateSeparator(ts: number): string {
  const date = new Date(ts * 1000)
  if (isToday(date)) return 'Hoje'
  if (isYesterday(date)) return 'Ontem'
  return format(date, "d 'de' MMMM", { locale: pt })
}

// WhatsApp brand icon (simple SVG)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export function WhatsAppChatBubble({ contactPhone, contactName }: WhatsAppChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [resolved, setResolved] = useState<ResolvedChat | null>(null)
  const [resolving, setResolving] = useState(false)
  const [replyTo, setReplyTo] = useState<WppMessage | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  const chatId = resolved?.found ? resolved.chat_id! : null
  const instanceId = resolved?.instance_id || null

  const {
    messages,
    quotedMessages,
    isLoading,
    isSending,
    hasMore,
    loadMore,
    sendText,
    sendMedia,
    sendAudio,
    markRead,
  } = useWhatsAppMessages(isOpen ? chatId : null)

  const { isTyping, sendPresence } = useWhatsAppPresence(isOpen ? instanceId : null)

  // Resolve phone → chat on first open
  useEffect(() => {
    if (!isOpen || resolved || resolving || !contactPhone) return

    setResolving(true)
    const digits = contactPhone.replace(/\D/g, '')
    const params = new URLSearchParams({ phone: digits })
    if (contactName) params.set('name', contactName)
    fetch(`/api/whatsapp/resolve-chat?${params}`)
      .then((r) => r.json())
      .then((data) => setResolved(data))
      .catch(() => setResolved({ found: false, reason: 'error' }))
      .finally(() => setResolving(false))
  }, [isOpen, resolved, resolving, contactPhone])

  // Mark as read when opened
  useEffect(() => {
    if (isOpen && chatId) markRead()
  }, [isOpen, chatId, markRead])

  // Scroll to bottom on new messages
  const prevChatRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isLoading && messages.length > 0 && bottomRef.current) {
      if (prevChatRef.current !== chatId) {
        prevChatRef.current = chatId
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView())
      } else if (isAtBottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [isLoading, messages, chatId])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    if (el.scrollTop < 100 && hasMore && !isLoading) loadMore()
  }, [hasMore, isLoading, loadMore])

  const handleSendPresence = useCallback(() => {
    if (chatId) sendPresence(chatId, 'composing')
  }, [chatId, sendPresence])

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: WppMessage[] }[] = []
    let currentGroup: { date: string; messages: WppMessage[] } | null = null
    for (const msg of messages) {
      const msgDate = new Date(msg.timestamp * 1000)
      if (!currentGroup || !isSameDay(msgDate, new Date(currentGroup.messages[0].timestamp * 1000))) {
        currentGroup = { date: formatDateSeparator(msg.timestamp), messages: [] }
        groups.push(currentGroup)
      }
      currentGroup.messages.push(msg)
    }
    return groups
  }, [messages])

  const chatTyping = chatId ? isTyping(chatId) : false
  // Always prefer the lead/contact name from the ERP
  const displayName = contactName
  const picUrl = resolved?.profile_pic_url

  // Don't render if no phone
  if (!contactPhone) return null

  return (
    <>
      {/* Chat Panel */}
      <div
        className={cn(
          'fixed bottom-28 sm:bottom-20 right-4 left-4 z-50 sm:left-auto sm:w-[420px] rounded-2xl border bg-background shadow-2xl transition-all duration-300 ease-out overflow-hidden',
          isOpen
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
        )}
        style={{ height: 'min(550px, calc(100vh - 140px))' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-2.5 bg-emerald-600 text-white rounded-t-2xl">
          <Avatar className="h-8 w-8">
            {picUrl && <AvatarImage src={picUrl} alt={displayName} />}
            <AvatarFallback className="bg-emerald-700 text-white text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{displayName}</div>
            {chatTyping ? (
              <div className="text-xs text-emerald-100">A escrever...</div>
            ) : (
              <div className="text-xs text-emerald-100 truncate">
                {contactPhone}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {chatId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-emerald-700 hover:text-white"
                onClick={() => window.open(`/dashboard/whatsapp?chat=${chatId}`, '_blank')}
                title="Abrir no WhatsApp"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-emerald-700 hover:text-white"
              onClick={() => setIsOpen(false)}
              title="Minimizar"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isOpen && (
          <div className="flex flex-col" style={{ height: 'calc(100% - 53px)' }}>
            {resolving ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mx-auto" />
                  <p className="text-sm text-muted-foreground">A procurar conversa...</p>
                </div>
              </div>
            ) : !resolved?.found ? (
              <div className="flex-1 flex items-center justify-center px-6">
                <div className="text-center space-y-3">
                  <MessageSquareWarning className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <div>
                    <p className="text-sm font-medium">Sem conversa WhatsApp</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {resolved?.reason === 'no_instances'
                        ? 'Não tem instâncias WhatsApp activas.'
                        : resolved?.reason === 'no_contact'
                          ? `Não foi encontrado contacto para ${contactPhone}.`
                          : `Ainda não há conversa com ${contactName}.`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      window.open(
                        `https://wa.me/${contactPhone.replace(/\D/g, '')}`,
                        '_blank'
                      )
                    }
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5 mr-1.5" />
                    Abrir no WhatsApp
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto px-3 py-2 bg-muted/30"
                >
                  {isLoading ? (
                    <div className="space-y-3 py-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                          <Skeleton className="h-10 w-40 rounded-lg" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {hasMore && (
                        <div className="text-center py-2">
                          <button
                            type="button"
                            onClick={loadMore}
                            className="text-xs text-primary hover:underline"
                          >
                            Carregar anteriores
                          </button>
                        </div>
                      )}

                      {groupedMessages.map((group) => (
                        <div key={group.date}>
                          <div className="flex items-center justify-center my-2">
                            <span className="bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-2.5 py-0.5 rounded-full shadow-sm">
                              {group.date}
                            </span>
                          </div>
                          {group.messages.map((msg) => (
                            <MessageBubble
                              key={msg.id}
                              message={msg}
                              quotedMessage={
                                msg.quoted_message_id
                                  ? quotedMessages[msg.quoted_message_id]
                                  : undefined
                              }
                              onReply={() => setReplyTo(msg)}
                              onReact={() => {}}
                              onDelete={() => {}}
                              onForward={() => {}}
                              instanceId={instanceId || undefined}
                            />
                          ))}
                        </div>
                      ))}

                      {chatTyping && (
                        <div className="flex justify-start mb-2">
                          <TypingIndicator />
                        </div>
                      )}

                      <div ref={bottomRef} />
                    </>
                  )}
                </div>

                {/* Input */}
                <ChatInput
                  onSendText={(text) => sendText(text, replyTo?.wa_message_id)}
                  onSendMedia={(file, type, caption) =>
                    sendMedia(file, type, caption, replyTo?.wa_message_id)
                  }
                  onSendAudio={(file) => sendAudio(file, replyTo?.wa_message_id)}
                  onSendPresence={handleSendPresence}
                  replyTo={replyTo}
                  onCancelReply={() => setReplyTo(null)}
                  disabled={isSending}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Floating Button */}
      <button
        onClick={handleToggle}
        className={cn(
          'fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95',
          'h-14 w-14',
          isOpen
            ? 'bg-muted text-muted-foreground hover:bg-muted/90'
            : 'bg-emerald-500 text-white hover:bg-emerald-600'
        )}
        title={isOpen ? 'Fechar chat WhatsApp' : `Conversar com ${contactName}`}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <WhatsAppIcon className="h-6 w-6" />
        )}
      </button>
    </>
  )
}
