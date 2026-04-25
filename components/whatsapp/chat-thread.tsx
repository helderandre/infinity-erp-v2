'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { isToday, isYesterday, format, isSameDay } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Forward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useWhatsAppMessages } from '@/hooks/use-whatsapp-messages'
import { useWhatsAppPresence } from '@/hooks/use-whatsapp-presence'
import { useUser } from '@/hooks/use-user'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { ChatHeader } from './chat-header'
import { ChatInput } from './chat-input'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'
import { ForwardDialog } from './forward-dialog'
import { SaveToErpDialog } from './save-to-erp-dialog'
import type { WppChat, WppMessage } from '@/lib/types/whatsapp-web'

interface ChatThreadProps {
  chatId: string
  instanceId: string
  onToggleInfo: () => void
  onBack?: () => void
}

function formatDateSeparator(ts: number): string {
  const date = new Date(ts * 1000)
  if (isToday(date)) return 'Hoje'
  if (isYesterday(date)) return 'Ontem'
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: pt })
}

export function ChatThread({ chatId, instanceId, onToggleInfo, onBack }: ChatThreadProps) {
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
    sendPoll,
    react,
    deleteMessage,
    markRead,
  } = useWhatsAppMessages(chatId)

  const { isTyping, sendPresence } = useWhatsAppPresence(instanceId)
  const { user } = useUser()
  const isAdmin = useMemo(
    () => ADMIN_ROLES.some((r) => r.toLowerCase() === user?.role?.name?.toLowerCase()),
    [user?.role?.name]
  )
  const [replyTo, setReplyTo] = useState<WppMessage | null>(null)
  const [chat, setChat] = useState<WppChat | null>(null)
  const [forwardMessages, setForwardMessages] = useState<WppMessage[]>([])
  const [showForwardDialog, setShowForwardDialog] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saveToErpMsg, setSaveToErpMsg] = useState<WppMessage | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  // Fetch chat info
  useEffect(() => {
    if (!chatId) return
    fetch(`/api/whatsapp/chats?chat_id=${chatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.chat) setChat(data.chat)
      })
      .catch(() => {})
  }, [chatId])

  // Mark as read on open
  useEffect(() => {
    markRead()
  }, [chatId, markRead])

  // Reset "new chat" marker when the user switches chats — forces the
  // scroll-to-bottom effect below to treat the next populated render as a
  // fresh chat open, even if the previous chat had the same id recently.
  const prevChatIdRef = useRef<string | null>(null)
  useEffect(() => {
    prevChatIdRef.current = null
    isAtBottomRef.current = true
  }, [chatId])

  // Scroll to bottom when chat changes (after messages load)
  useEffect(() => {
    if (isLoading || messages.length === 0) return
    const el = scrollRef.current
    if (!el) return

    if (prevChatIdRef.current !== chatId) {
      // New chat opened — instant scroll to bottom, retried after a tick so
      // late-sized content (images, media) doesn't leave us a few pixels short.
      prevChatIdRef.current = chatId
      const jumpToBottom = () => {
        el.scrollTop = el.scrollHeight
      }
      requestAnimationFrame(jumpToBottom)
      const t1 = window.setTimeout(jumpToBottom, 50)
      const t2 = window.setTimeout(jumpToBottom, 250)
      return () => {
        window.clearTimeout(t1)
        window.clearTimeout(t2)
      }
    }

    if (isAtBottomRef.current) {
      // Same chat, new message — smooth scroll
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isLoading, messages, chatId])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    // Check if at bottom
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50

    // Load more when scrolled to top
    if (el.scrollTop < 100 && hasMore && !isLoading) {
      loadMore()
    }
  }, [hasMore, isLoading, loadMore])

  const handleSendPresence = useCallback(() => {
    sendPresence(chatId, 'composing')
  }, [chatId, sendPresence])

  const toggleSelect = useCallback((msgId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }, [])

  const handleForwardSelected = useCallback(() => {
    const selected = messages.filter(m => selectedIds.has(m.id))
    if (selected.length === 0) return
    setForwardMessages(selected)
    setShowForwardDialog(true)
  }, [messages, selectedIds])

  const handleForwardSingle = useCallback((msg: WppMessage) => {
    setForwardMessages([msg])
    setShowForwardDialog(true)
  }, [])

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  // Group messages by date
  const groupedMessages: { date: string; messages: WppMessage[] }[] = []
  let currentGroup: { date: string; messages: WppMessage[] } | null = null

  for (const msg of messages) {
    const msgDate = new Date(msg.timestamp * 1000)
    if (!currentGroup || !isSameDay(msgDate, new Date(currentGroup.messages[0].timestamp * 1000))) {
      currentGroup = { date: formatDateSeparator(msg.timestamp), messages: [] }
      groupedMessages.push(currentGroup)
    }
    currentGroup.messages.push(msg)
  }

  // Build mention map from all senders in this chat (lid → name)
  const mentionMap = useMemo(() => {
    if (!chat?.is_group) return undefined
    const map: Record<string, string> = {}
    for (const msg of messages) {
      if (msg.sender && msg.sender_name) {
        // Store by lid number (without @lid suffix)
        const lid = msg.sender.replace('@lid', '')
        if (!map[lid]) map[lid] = msg.sender_name
      }
    }
    return Object.keys(map).length > 0 ? map : undefined
  }, [messages, chat?.is_group])

  const handleSenderClick = useCallback((_sender: string, _senderName: string) => {
    // Open info panel to show participant details
    onToggleInfo()
  }, [onToggleInfo])

  const hasErpContact = !!(chat?.contact?.owner_id || chat?.contact?.lead_id)
  const chatTyping = isTyping(chatId)

  return (
    <div className="flex flex-col h-full" data-no-long-press>
      {/* Header */}
      <ChatHeader
        chat={chat}
        isTyping={chatTyping}
        onToggleInfo={onToggleInfo}
        onBack={onBack}
      />

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2 bg-muted/30"
      >
        {isLoading ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <Skeleton className="h-12 w-48 rounded-lg" />
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
                  Carregar mensagens anteriores
                </button>
              </div>
            )}

            {groupedMessages.map((group, groupIdx) => (
              <div key={`${group.date}-${group.messages[0]?.id ?? groupIdx}`}>
                {/* Date Separator */}
                <div className="flex items-center justify-center my-3">
                  <span className="bg-background/80 backdrop-blur-sm text-xs text-muted-foreground px-3 py-1 rounded-full shadow-sm">
                    {group.date}
                  </span>
                </div>

                {group.messages.map((msg, idx) => {
                  // In groups: detect when sender changes for spacing & name display
                  const prevMsg = idx > 0 ? group.messages[idx - 1] : null
                  const isNewSender = !msg.from_me && chat?.is_group && (
                    !prevMsg || prevMsg.from_me || prevMsg.sender !== msg.sender
                  )
                  const senderChanged = isNewSender && prevMsg != null

                  return (
                    <div key={msg.id} className={`flex items-center gap-1 ${senderChanged ? 'mt-3' : ''}`}>
                      {selectMode && (
                        <button
                          type="button"
                          onClick={() => toggleSelect(msg.id)}
                          className={`flex-shrink-0 h-5 w-5 rounded-full border-2 transition-colors ${
                            selectedIds.has(msg.id)
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/40 hover:border-primary'
                          }`}
                        >
                          {selectedIds.has(msg.id) && (
                            <svg className="h-full w-full text-primary-foreground" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <MessageBubble
                          message={msg}
                          quotedMessage={msg.quoted_message_id ? quotedMessages[msg.quoted_message_id] : undefined}
                          onReply={() => setReplyTo(msg)}
                          onReact={(emoji) => react(msg.id, emoji)}
                          onDelete={(forEveryone) => deleteMessage(msg.id, forEveryone)}
                          onForward={() => handleForwardSingle(msg)}
                          onSelect={() => {
                            setSelectMode(true)
                            setSelectedIds(new Set([msg.id]))
                          }}
                          onSaveToErp={() => setSaveToErpMsg(msg)}
                          onSenderClick={handleSenderClick}
                          hasErpContact={hasErpContact}
                          showSenderName={!!isNewSender}
                          isAdmin={isAdmin}
                          instanceId={instanceId}
                          mentionMap={mentionMap}
                        />
                      </div>
                    </div>
                  )
                })}
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

      {/* Selection toolbar */}
      {selectMode ? (
        <div className="border-t bg-background px-4 py-2.5 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedIds.size > 0
              ? `${selectedIds.size} mensagem(ns) seleccionada(s)`
              : 'Seleccione mensagens para reencaminhar'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exitSelectMode}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleForwardSelected}
              disabled={selectedIds.size === 0}
            >
              <Forward className="h-4 w-4 mr-1.5" />
              Reencaminhar ({selectedIds.size})
            </Button>
          </div>
        </div>
      ) : (
        /* Input */
        <ChatInput
          onSendText={(text) => sendText(text, replyTo?.wa_message_id)}
          onSendMedia={(file, type, caption) => sendMedia(file, type, caption, replyTo?.wa_message_id)}
          onSendAudio={(file) => sendAudio(file, replyTo?.wa_message_id)}
          onSendPoll={(question, options, selectableCount) => sendPoll(question, options, selectableCount, replyTo?.wa_message_id)}
          onSendPresence={handleSendPresence}
          onSendPropertyCards={async (properties) => {
            for (const prop of properties) {
              const publicUrl = `${process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://infinitygroup.pt'}/property/${prop.slug}`
              const lines = [
                `🏠 *${prop.title}*`,
                prop.listing_price ? `💰 ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(prop.listing_price)}` : '',
                [prop.typology, prop.area_util ? `${prop.area_util}m²` : '', prop.city].filter(Boolean).join(' · '),
                '',
                publicUrl,
              ].filter((l) => l !== '').join('\n')

              if (prop.cover_url) {
                try {
                  const imgRes = await fetch(prop.cover_url)
                  const blob = await imgRes.blob()
                  const file = new File([blob], `${prop.slug}.jpg`, { type: blob.type || 'image/jpeg' })
                  await sendMedia(file, 'image', lines)
                } catch {
                  await sendText(lines)
                }
              } else {
                await sendText(lines)
              }
            }
          }}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          messages={messages}
          contactLeadId={chat?.contact?.lead_id}
          chatId={chatId}
          instanceId={instanceId}
        />
      )}

      {/* Forward Dialog */}
      <ForwardDialog
        open={showForwardDialog}
        onClose={() => {
          setShowForwardDialog(false)
          setForwardMessages([])
          exitSelectMode()
        }}
        messages={forwardMessages}
        instanceId={instanceId}
      />

      {/* Save to ERP Dialog */}
      <SaveToErpDialog
        open={!!saveToErpMsg}
        onOpenChange={(open) => { if (!open) setSaveToErpMsg(null) }}
        message={saveToErpMsg}
        contactId={chat?.contact?.id ?? null}
        instanceId={instanceId}
      />
    </div>
  )
}
