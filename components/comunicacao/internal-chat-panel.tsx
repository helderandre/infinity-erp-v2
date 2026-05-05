'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MentionsInput, Mention } from 'react-mentions'
import { MessageSquare, Paperclip, Send, X, Mic, ChevronDown, Pencil, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { useInternalChat } from '@/hooks/use-internal-chat'
import { useInternalChatPresence } from '@/hooks/use-internal-chat-presence'
import { useIsMobile } from '@/hooks/use-mobile'
import { ChatMessageItem } from '@/components/processes/chat-message'
import { VoiceRecorder } from '@/components/processes/voice-recorder'
import { InternalForwardDialog } from '@/components/comunicacao/internal-forward-dialog'
import { CHAT_LABELS, VOICE_LABELS } from '@/lib/constants'
import type { InternalChatMessage, InternalChatMention, InternalChatReadReceipt } from '@/types/internal-chat'

const INTERNAL_CHAT_LABELS = {
  ...CHAT_LABELS,
  title: 'Grupo Geral',
  no_messages: 'Sem mensagens ainda — comece a conversa!',
  // Placeholder curto para não rebentar o layout do textarea em mobile —
  // a dica de @ mention já está implícita pelo `@` que abre o picker.
  placeholder: 'Mensagem…',
}

const mentionsInputStyle = {
  control: { fontSize: 14, fontWeight: 'normal' as const },
  '&multiLine': {
    control: { minHeight: 40 },
    highlighter: { padding: 9, border: '1px solid transparent' },
    input: {
      padding: 9,
      border: '1px solid hsl(var(--border))',
      borderRadius: 8,
      outline: 'none',
    },
  },
  suggestions: {
    list: {
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 8,
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      overflow: 'hidden',
      maxHeight: 200,
      overflowY: 'auto' as const,
    },
    item: {
      '&focused': { backgroundColor: 'hsl(var(--muted))' },
    },
  },
}

const mentionStyle = {
  backgroundColor: 'hsl(var(--primary) / 0.1)',
  borderRadius: 4,
  padding: '1px 2px',
}

interface InternalChatPanelProps {
  currentUser: { id: string; name: string; avatarUrl?: string }
  channelId?: string
  dmRecipientId?: string
  header?: React.ReactNode
}

export function InternalChatPanel({ currentUser, channelId, dmRecipientId, header }: InternalChatPanelProps) {
  const {
    messages,
    readReceipts,
    isLoading,
    isSending,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    markAsRead,
    refetch,
  } = useInternalChat(channelId, dmRecipientId)

  const { onlineUsers, typingUsers, setTyping } = useInternalChatPresence(currentUser)
  // Em mobile, Enter insere uma nova linha (não submete) — o envio é
  // exclusivamente pelo botão de avião. Em desktop, Enter submete e
  // Shift+Enter quebra a linha (mantém o comportamento legacy).
  const isMobile = useIsMobile()

  const [replyTo, setReplyTo] = useState<InternalChatMessage | null>(null)
  const [forwardMessage, setForwardMessage] = useState<InternalChatMessage | null>(null)
  const [editingMessage, setEditingMessage] = useState<InternalChatMessage | null>(null)
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mentionUsers, setMentionUsers] = useState<{ id: string; display: string }[]>([])
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Ref ao textarea interno do MentionsInput para conseguir refocus
  // após enviar mensagem — o `disabled={isSubmitting}` durante o submit
  // tira o foco e por defeito não volta. Devolver o foco mantém o
  // utilizador a escrever sem ter de clicar de novo.
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const firstRenderRef = useRef(true)
  const lastMsgCountRef = useRef(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [unreadBelow, setUnreadBelow] = useState(0)

  // Fetch users for @ mentions
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users/consultants')
        if (!res.ok) return
        const data: { id: string; commercial_name: string }[] = await res.json()
        setMentionUsers(data.map((u) => ({ id: u.id, display: u.commercial_name })))
      } catch {
        // silent
      }
    }
    loadUsers()
  }, [])

  // Build readers map from read receipts
  const messageReadersMap = useMemo(() => {
    const map = new Map<string, { userName: string; readAt: string }[]>()
    if (!messages.length || !readReceipts.length) return map

    const idxMap = new Map<string, number>()
    messages.forEach((m, i) => idxMap.set(m.id, i))

    for (const receipt of readReceipts) {
      const r = receipt as InternalChatReadReceipt
      if (!r.last_read_message_id) continue
      const lastReadIdx = idxMap.get(r.last_read_message_id)
      if (lastReadIdx === undefined) continue

      for (let i = 0; i <= lastReadIdx; i++) {
        const msgId = messages[i].id
        if (messages[i].sender_id === r.user_id) continue
        const existing = map.get(msgId) || []
        existing.push({
          userName: (r.user as { commercial_name: string })?.commercial_name || 'Utilizador',
          readAt: r.last_read_at,
        })
        map.set(msgId, existing)
      }
    }
    return map
  }, [messages, readReceipts])

  // Auto-scroll com comportamento WhatsApp:
  //  - Primeiro load: jump instantâneo para o fundo (última mensagem).
  //  - Mensagens novas: só auto-scroll se o utilizador já está no fundo OU
  //    se a mensagem é dele próprio. Caso contrário, incrementa um badge
  //    de "N novas" no botão flutuante de scroll-to-bottom.
  //
  // O scroll é diferido com rAF + retries para resistir a:
  //  - Sheets ainda em animação de abertura (height/clientHeight muda).
  //  - Imagens/avatares que carregam tarde e empurram o scroll.
  //  - Notification handlers que abrem o panel mid-render.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || messages.length === 0) {
      lastMsgCountRef.current = messages.length
      return
    }
    const newCount = messages.length - lastMsgCountRef.current
    lastMsgCountRef.current = messages.length

    const jumpToBottom = (smooth: boolean) => {
      // Prefer scrollIntoView no sentinel — robusto contra recálculos
      // de scrollHeight pós-paint (imagens a carregar, layout a estabilizar).
      const end = endRef.current
      if (end) {
        end.scrollIntoView({ block: 'end', behavior: smooth ? 'smooth' : 'auto' })
      } else if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
      }
    }

    if (firstRenderRef.current) {
      firstRenderRef.current = false
      // 3 attempts em frames sucessivos + um retry tardio. Se o sheet ainda
      // está a animar ou imagens ainda não carregaram, alguma destas vai
      // apanhar o estado final. Custo: zero perceptível pelo utilizador.
      requestAnimationFrame(() => {
        jumpToBottom(false)
        requestAnimationFrame(() => {
          jumpToBottom(false)
          setTimeout(() => jumpToBottom(false), 150)
        })
      })
      setIsAtBottom(true)
      setUnreadBelow(0)
      return
    }

    if (newCount > 0) {
      const lastMsg = messages[messages.length - 1]
      const ownMessage = lastMsg.sender_id === currentUser.id
      if (ownMessage || isAtBottom) {
        requestAnimationFrame(() => jumpToBottom(true))
        setUnreadBelow(0)
      } else {
        setUnreadBelow((prev) => prev + newCount)
      }
    }
  }, [messages, isAtBottom, currentUser.id])

  // Detecta quando o utilizador está perto do fundo (tolerância 80px) — usado
  // para decidir se auto-scroll de mensagens novas + esconder o botão.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distance < 80
    setIsAtBottom(atBottom)
    if (atBottom) setUnreadBelow(0)
  }, [])

  const scrollToBottom = useCallback(() => {
    const end = endRef.current
    const el = scrollRef.current
    if (end) {
      end.scrollIntoView({ block: 'end', behavior: 'smooth' })
    } else if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
    setUnreadBelow(0)
  }, [])

  // Mark as read
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.sender_id !== currentUser.id) {
        markAsRead(lastMessage.id)
      }
    }
  }, [messages, currentUser.id, markAsRead])

  // Typing
  const handleValueChange = useCallback(
    (newValue: string) => {
      setValue(newValue)
      if (newValue.trim()) setTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000)
    },
    [setTyping]
  )

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  // Uploads em paralelo (Promise.allSettled) — cada ficheiro é
  // independente. Devolve `true` se TODOS subiram com sucesso.
  const uploadAttachments = useCallback(async (messageId: string, files: File[]): Promise<boolean> => {
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('messageId', messageId)

        const res = await fetch('/api/chat/internal/upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || INTERNAL_CHAT_LABELS.upload_error)
        }
      }),
    )

    let allOk = true
    results.forEach((result, i) => {
      const file = files[i]
      if (result.status === 'fulfilled') {
        toast.success(`${file.name} — ${INTERNAL_CHAT_LABELS.upload_success}`)
      } else {
        allOk = false
        const reason = result.reason
        toast.error(`${file.name} — ${reason instanceof Error ? reason.message : INTERNAL_CHAT_LABELS.upload_error}`)
      }
    })
    return allOk
  }, [])

  // Inicia edição WhatsApp-style — passa o conteúdo da mensagem para o
  // composer e cancela qualquer reply em curso. O ChatMessageItem dispara
  // isto a partir do dropdown "Editar"; a mensagem fica destacada via
  // `isBeingEdited`.
  const handleStartEdit = useCallback((msg: InternalChatMessage) => {
    setEditingMessage(msg)
    setValue(msg.content)
    setReplyTo(null)
    setAttachments([])
    requestAnimationFrame(() => {
      messageInputRef.current?.focus()
      // Cursor no fim do texto
      const el = messageInputRef.current
      if (el) {
        const len = el.value.length
        try { el.setSelectionRange(len, len) } catch {}
      }
    })
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null)
    setValue('')
  }, [])

  // Submit — quando há `editingMessage`, chama editMessage em vez de
  // sendMessage. Edição exige texto (não suportamos esvaziar uma
  // mensagem); envio basta texto OU anexos (imagens podem ir sem
  // caption — paridade com WhatsApp).
  const handleSubmit = useCallback(async () => {
    const hasText = Boolean(value.trim())
    const hasAttachments = attachments.length > 0
    if (isSubmitting) return
    if (editingMessage) {
      if (!hasText) return
    } else if (!hasText && !hasAttachments) {
      return
    }
    setIsSubmitting(true)
    setTyping(false)

    try {
      // Edit mode: actualizar mensagem existente.
      if (editingMessage) {
        // No-op se o utilizador não mudou nada — evita bater no servidor à toa.
        if (value.trim() !== editingMessage.content.trim()) {
          await editMessage(editingMessage.id, value)
        }
        setEditingMessage(null)
        setValue('')
        return
      }

      const mentions: InternalChatMention[] = []
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
      let match
      while ((match = mentionRegex.exec(value)) !== null) {
        mentions.push({ display_name: match[1], user_id: match[2] })
      }

      const msg = await sendMessage(value, mentions, replyTo?.id)

      // AGUARDAMOS uploads antes de fechar o submit. Sem await, o
      // utilizador podia trocar de conversa, fechar o sheet de
      // conversas em mobile, ou pressionar enviar de novo enquanto a
      // imagem subia em background, e ela nunca aparecia. Refrescamos
      // a lista no fim para o balão mostrar a imagem mesmo que o
      // realtime UPDATE atrase ou falhe.
      if (msg?.id && attachments.length > 0) {
        await uploadAttachments(msg.id, attachments)
        refetch()
      }

      setValue('')
      setAttachments([])
      setReplyTo(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : editingMessage ? 'Erro ao editar' : 'Erro ao enviar mensagem')
    } finally {
      setIsSubmitting(false)
      // Devolve o foco ao textarea após o disabled sair (próximo tick).
      // Sem isto, o utilizador precisa de clicar de novo para continuar
      // a escrever — péssima UX para conversa fluida.
      requestAnimationFrame(() => {
        messageInputRef.current?.focus()
      })
    }
  }, [value, isSubmitting, sendMessage, editMessage, editingMessage, setTyping, replyTo, attachments, uploadAttachments, refetch])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const maxSize = 20 * 1024 * 1024
    const valid = files.filter((f) => {
      if (f.size > maxSize) {
        toast.error(`${f.name}: ${INTERNAL_CHAT_LABELS.max_file_size}`)
        return false
      }
      return true
    })
    setAttachments((prev) => [...prev, ...valid])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleVoiceSend = useCallback(async (audioBlob: Blob, durationMs: number) => {
    try {
      const durationSec = Math.ceil(durationMs / 1000)
      const minutes = Math.floor(durationSec / 60)
      const seconds = durationSec % 60
      const durationLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`

      const msg = await sendMessage(`🎤 ${VOICE_LABELS.voice_message} (${durationLabel})`, [])
      if (!msg?.id) throw new Error('Mensagem não criada')

      const ext = audioBlob.type.includes('webm') ? 'webm' : 'ogg'
      const file = new File([audioBlob], `voice-message-${Date.now()}.${ext}`, {
        type: audioBlob.type,
      })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('messageId', msg.id)

      const res = await fetch('/api/chat/internal/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || VOICE_LABELS.error)
      }

      toast.success(VOICE_LABELS.sent)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : VOICE_LABELS.error)
    }
  }, [sendMessage])

  const onlineCount = onlineUsers.filter((u) => u.user_id !== currentUser.id).length

  const typingText =
    typingUsers.length === 1
      ? `${typingUsers[0].user_name} ${INTERNAL_CHAT_LABELS.typing_one}`
      : typingUsers.length > 1
        ? `${typingUsers.map((u) => u.user_name).join(', ')} ${INTERNAL_CHAT_LABELS.typing_many}`
        : null

  return (
    <div className="flex flex-col h-full">
      <InternalForwardDialog
        open={forwardMessage !== null}
        onOpenChange={(open) => { if (!open) setForwardMessage(null) }}
        messageContent={forwardMessage?.content ?? ''}
        messageId={forwardMessage?.id ?? null}
        hasAttachments={Boolean(forwardMessage?.has_attachments)}
        currentUserId={currentUser.id}
      />
      {/* Header */}
      {header || (
        <div className="border-b px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{INTERNAL_CHAT_LABELS.title}</span>
            {messages.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] font-medium rounded-full">
                {messages.length}
              </Badge>
            )}
          </div>
          {onlineCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {onlineCount} {INTERNAL_CHAT_LABELS.online}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          'absolute inset-0 overflow-y-auto px-4 py-4 space-y-4 transition-[filter,opacity] duration-200',
          // WhatsApp-style: ao editar, faz blur da conversa para focar
          // o utilizador no composer. Click na zona blurred cancela o edit.
          editingMessage && 'blur-sm opacity-90',
        )}
        onClickCapture={(e) => {
          if (!editingMessage) return
          // Não cancelar quando clica numa mensagem que ainda quer ler
          // ou em interactivos — só cliques "vazios" no fundo cancelam.
          const target = e.target as HTMLElement
          if (target.closest('button, a, [role="button"]')) return
        }}
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'justify-end'}`}>
              {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
              <div className={`space-y-1 ${i % 2 === 0 ? '' : 'items-end'}`}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className={`h-12 ${i % 2 === 0 ? 'w-56' : 'w-44'} rounded-2xl`} />
              </div>
              {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
            </div>
          ))
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">{INTERNAL_CHAT_LABELS.no_messages}</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg as any}
                currentUserId={currentUser.id}
                processId=""
                onReply={() => setReplyTo(msg)}
                onToggleReaction={toggleReaction}
                onEdit={editMessage}
                onStartEdit={(m) => handleStartEdit(m as any)}
                onDelete={deleteMessage}
                onForward={(m) => setForwardMessage(m as any)}
                readers={messageReadersMap.get(msg.id)}
                isBeingEdited={editingMessage?.id === msg.id}
              />
            ))}
          </>
        )}

        {typingText && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            {typingText}
          </div>
        )}

        {/* Sentinel — alvo do scrollIntoView. Garante que "ir para o fundo"
            funciona mesmo quando scrollHeight ainda não estabilizou (sheet
            a animar, imagens a carregar). */}
        <div ref={endRef} aria-hidden className="h-px" />
      </div>

      {/* Floating "scroll to bottom" arrow — só visível quando o utilizador
          subiu na conversa. Mostra badge com contagem de mensagens novas
          recebidas enquanto estava em cima (não-próprias). */}
      {!isAtBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className={cn(
            'absolute bottom-3 right-3 z-10 flex h-10 w-10 items-center justify-center',
            'rounded-full bg-zinc-900/85 hover:bg-zinc-900 text-white',
            'shadow-lg backdrop-blur-md border border-white/10 transition-colors',
            'animate-in fade-in zoom-in-95 duration-150',
          )}
          aria-label="Ir para a mensagem mais recente"
        >
          <ChevronDown className="h-5 w-5" />
          {unreadBelow > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 rounded-full bg-red-500 text-[10px] font-medium text-white ring-2 ring-background">
              {unreadBelow > 99 ? '99+' : unreadBelow}
            </span>
          )}
        </button>
      )}
      </div>

      {/* Input */}
      <div className={cn(
        'border-t px-4 py-3 shrink-0 transition-colors',
        editingMessage && 'bg-primary/[0.04]',
      )}>
        <div className="space-y-2">
          {/* Edit banner — pattern WhatsApp: "A editar mensagem" com preview
              + X. Sobrepõe-se ao reply preview (não mostramos os dois). */}
          {editingMessage && (
            <div className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-3 py-1.5 border-l-2 border-primary">
              <Pencil className="h-3 w-3 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-primary">A editar mensagem</span>
                <p className="text-muted-foreground truncate mt-0.5">{editingMessage.content.slice(0, 80)}</p>
              </div>
            </div>
          )}

          {replyTo && !editingMessage && (
            <div className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-3 py-1.5 border-l-2 border-primary">
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground">{INTERNAL_CHAT_LABELS.reply_to} </span>
                <span className="font-medium">{replyTo.sender?.commercial_name || 'Utilizador'}</span>
                <p className="text-muted-foreground truncate mt-0.5">{replyTo.content.slice(0, 80)}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setReplyTo(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {!isRecording && !editingMessage && attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs bg-muted/50">
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate max-w-[140px]">{file.name}</span>
                  <Button variant="ghost" size="icon" className="h-4 w-4 p-0" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}>
                    <X className="h-2.5 w-2.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {isRecording && !editingMessage && (
            <VoiceRecorder
              autoStart
              onSend={handleVoiceSend}
              onCancel={() => setIsRecording(false)}
              disabled={isSending}
            />
          )}

          {(!isRecording || editingMessage) && (
            <div className="flex items-end gap-2">
              {/* Edit mode: X cancel à esquerda. */}
              {editingMessage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                  title="Cancelar edição"
                  aria-label="Cancelar edição"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              <div className="flex-1 relative">
                <MentionsInput
                  inputRef={messageInputRef}
                  value={value}
                  onChange={(_e, newValue) => handleValueChange(newValue)}
                  placeholder={editingMessage ? 'Edita a mensagem…' : INTERNAL_CHAT_LABELS.placeholder}
                  style={mentionsInputStyle}
                  a11ySuggestionsListLabel="Utilizadores sugeridos"
                  forceSuggestionsAboveCursor
                  onKeyDown={(e) => {
                    // Em mobile não submetemos com Enter — só pelo botão.
                    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
                      e.preventDefault()
                      handleSubmit()
                    }
                    if (e.key === 'Escape' && editingMessage) {
                      e.preventDefault()
                      handleCancelEdit()
                    }
                  }}
                  disabled={isSending || isSubmitting}
                >
                  <Mention
                    trigger="@"
                    data={mentionUsers}
                    markup="@[__display__](__id__)"
                    displayTransform={(_id, display) => `@${display}`}
                    style={mentionStyle}
                    renderSuggestion={(suggestion, _search, highlightedDisplay) => (
                      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {(suggestion as { display?: string }).display?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm">{highlightedDisplay}</span>
                      </div>
                    )}
                  />
                </MentionsInput>
              </div>

              {/* Em edit mode escondemos paperclip + mic — não suportamos
                  alterar anexos/áudio na edição (só o texto). */}
              {!editingMessage && (
                <>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || isSubmitting}
                    title={INTERNAL_CHAT_LABELS.attach_file}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground"
                    onClick={() => setIsRecording(true)}
                    disabled={isSending || isSubmitting}
                    title={VOICE_LABELS.record}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                </>
              )}

              <Button
                size="icon"
                className={cn(
                  'h-9 w-9 shrink-0',
                  editingMessage && 'rounded-full bg-emerald-600 hover:bg-emerald-700 text-white',
                )}
                onClick={handleSubmit}
                disabled={!value.trim() || isSubmitting || isSending}
                title={editingMessage ? 'Gravar edição' : INTERNAL_CHAT_LABELS.send}
                aria-label={editingMessage ? 'Gravar edição' : INTERNAL_CHAT_LABELS.send}
              >
                {isSubmitting ? (
                  <Spinner variant="infinite" size={14} />
                ) : editingMessage ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
