'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MentionsInput, Mention } from 'react-mentions'
import { Button } from '@/components/ui/button'
import { Paperclip, Send, X, ClipboardList, Pin, FileText, Mic, Pencil, Check } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { CHAT_LABELS, VOICE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { VoiceRecorder } from './voice-recorder'
import { useIsMobile } from '@/hooks/use-mobile'
import { ChatAttachmentPreview } from '@/components/chat/chat-attachment-preview'
import type { ChatMention, ChatMessage } from '@/types/process'

interface ChatInputProps {
  processId: string
  onSend: (content: string, mentions: ChatMention[]) => Promise<ChatMessage | undefined>
  onTypingChange: (isTyping: boolean) => void
  disabled?: boolean
  replyTo?: { id: string; senderName: string; content: string } | null
  onCancelReply?: () => void
  /** Mensagem em edição (WhatsApp-style). Quando definida, o composer
   * pré-popula o conteúdo, troca os botões attach/mic por X cancel +
   * ✓ verde, e o submit chama `onSubmitEdit` em vez de `onSend`. */
  editingMessage?: { id: string; content: string } | null
  onSubmitEdit?: (messageId: string, content: string) => Promise<void>
  onCancelEdit?: () => void
  /** Disparado depois dos uploads de anexos terminarem (mesmo que algum
   * tenha falhado). Permite ao parent forçar refetch da lista para o
   * balão mostrar as imagens — não dependemos só do realtime UPDATE
   * (que pode atrasar ou falhar). */
  onAttachmentsUploaded?: () => void
  /** Estado de anexos lifted para o parent — necessário para o parent
   * conseguir mostrar o overlay de preview de imagens (style WhatsApp)
   * por cima da área das mensagens. Quando não fornecidos, ChatInput
   * gere o estado localmente (modo legado / standalone). */
  attachments?: File[]
  onAttachmentsChange?: React.Dispatch<React.SetStateAction<File[]>>
  /** Quando true esconde os chips de imagens — assumido que o parent
   * está a render o overlay. Não-imagens continuam a aparecer aqui. */
  hideImageChips?: boolean
  /** Notifica o parent quando o estado interno isSubmitting muda —
   * permite ao parent (ex.: overlay de imagens) mostrar spinner
   * durante o submit + upload completos. */
  onSubmittingChange?: (isSubmitting: boolean) => void
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

export function ChatInput({
  processId,
  onSend,
  onTypingChange,
  disabled = false,
  replyTo,
  onCancelReply,
  editingMessage,
  onSubmitEdit,
  onCancelEdit,
  onAttachmentsUploaded,
  attachments: externalAttachments,
  onAttachmentsChange: externalSetAttachments,
  hideImageChips = false,
  onSubmittingChange,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mentionUsers, setMentionUsers] = useState<{ id: string; display: string }[]>([])
  const [mentionEntities, setMentionEntities] = useState<{ id: string; display: string; type?: string; status?: string; extra?: string }[]>([])
  // `attachments` pode ser controlado pelo parent (necessário para o
  // overlay de preview de imagens). Quando o parent não fornece props,
  // usamos useState local — comportamento legado.
  const [internalAttachments, setInternalAttachments] = useState<File[]>([])
  const attachments = externalAttachments ?? internalAttachments
  const setAttachments = externalSetAttachments ?? setInternalAttachments
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Em mobile, Enter insere uma nova linha (não submete) — o envio é
  // exclusivamente pelo botão de avião. Em desktop mantém o legacy
  // (Enter submete, Shift+Enter quebra a linha).
  const isMobile = useIsMobile()

  // Quando o parent inicia uma edição, pré-popula o input com o conteúdo
  // actual e cancela qualquer voice-recording em curso. Quando termina
  // (editingMessage = null), limpa o input.
  useEffect(() => {
    if (editingMessage) {
      setValue(editingMessage.content)
      setIsRecording(false)
      setAttachments([])
    } else {
      // Só limpa se o último estado era de edição — evita apagar drafts
      // do utilizador quando o parent oscila por outras razões.
      // (O reset bate uma vez quando editingMessage transita true → null;
      // se já era null, o setValue('') é idempotente.)
      setValue('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMessage?.id])

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

  // Fetch entities for / mentions (tasks, subtasks, documents)
  useEffect(() => {
    const loadEntities = async () => {
      try {
        const res = await fetch(`/api/processes/${processId}/chat/entities`)
        if (!res.ok) return
        const data = await res.json()
        setMentionEntities(
          (data.entities || []).map((e: { id: string; display: string; type: string; status: string; extra?: string }) => ({
            id: e.id,
            display: e.display,
            type: e.type,
            status: e.status,
            extra: e.extra,
          }))
        )
      } catch {
        // silent
      }
    }
    loadEntities()
  }, [processId])

  // Typing indicator with debounce
  const handleValueChange = useCallback(
    (newValue: string) => {
      setValue(newValue)
      if (newValue.trim()) onTypingChange(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => onTypingChange(false), 2000)
    },
    [onTypingChange]
  )

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  // Propaga isSubmitting para o parent (usado pelo overlay de preview
  // de imagens para mostrar spinner durante o flow completo de
  // submit + upload). Disparado em qualquer transição.
  useEffect(() => {
    onSubmittingChange?.(isSubmitting)
  }, [isSubmitting, onSubmittingChange])

  // Uploads em paralelo (Promise.allSettled) — cada ficheiro é
  // independente. Devolve `true` se TODOS subiram com sucesso. Erros
  // por ficheiro mostram toast individual mas não quebram o lote — o
  // utilizador pode reenviar manualmente os que falharam.
  const uploadAttachments = useCallback(async (messageId: string, files: File[]): Promise<boolean> => {
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('processId', processId)
        formData.append('messageId', messageId)

        const res = await fetch('/api/chat/upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || CHAT_LABELS.upload_error)
        }
      }),
    )

    let allOk = true
    results.forEach((result, i) => {
      const file = files[i]
      if (result.status === 'fulfilled') {
        toast.success(`${file.name} — ${CHAT_LABELS.upload_success}`)
      } else {
        allOk = false
        const reason = result.reason
        toast.error(`${file.name} — ${reason instanceof Error ? reason.message : CHAT_LABELS.upload_error}`)
      }
    })
    return allOk
  }, [processId])

  const handleSubmit = useCallback(async () => {
    // Submissão em modo edição requer texto (não suportamos editar para
    // mensagem vazia). Em modo envio, basta haver texto OU anexos —
    // imagens podem ir sem caption (paridade com WhatsApp).
    const hasText = Boolean(value.trim())
    const hasAttachments = attachments.length > 0
    if (isSubmitting) return
    if (editingMessage) {
      if (!hasText) return
    } else if (!hasText && !hasAttachments) {
      return
    }

    setIsSubmitting(true)
    onTypingChange(false)

    try {
      // Edit mode: actualizar mensagem existente em vez de enviar nova.
      if (editingMessage && onSubmitEdit) {
        if (value.trim() !== editingMessage.content.trim()) {
          await onSubmitEdit(editingMessage.id, value)
        }
        // O parent é responsável por chamar onCancelEdit() para fechar o
        // edit mode após sucesso (clear vem do useEffect).
        return
      }

      // Parse mentions
      const mentions: ChatMention[] = []
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
      let match
      while ((match = mentionRegex.exec(value)) !== null) {
        mentions.push({ display_name: match[1], user_id: match[2] })
      }

      const msg = await onSend(value, mentions)

      // Upload attachments com a mensagem ID — AGUARDAMOS os uploads
      // antes de fechar o submit. Sem await, o utilizador podia sair da
      // conversa, minimizar o floating chat ou pressionar enviar de
      // novo enquanto o upload corria em background, e a imagem nunca
      // chegava. Com await + spinner no botão, a UX fica equivalente
      // ao WhatsApp: enviar bloqueia até a imagem subir.
      if (msg?.id && attachments.length > 0) {
        await uploadAttachments(msg.id, attachments)
        // Refrescamos a lista para o balão mostrar a imagem mesmo que
        // o realtime UPDATE do Supabase atrase ou não dispare.
        onAttachmentsUploaded?.()
      }

      setValue('')
      setAttachments([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : editingMessage ? 'Erro ao editar' : 'Erro ao enviar mensagem')
    } finally {
      setIsSubmitting(false)
    }
  }, [value, isSubmitting, onSend, onTypingChange, attachments, uploadAttachments, editingMessage, onSubmitEdit, onAttachmentsUploaded])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const maxSize = 20 * 1024 * 1024
    const valid = files.filter((f) => {
      if (f.size > maxSize) {
        toast.error(`${f.name}: ${CHAT_LABELS.max_file_size}`)
        return false
      }
      return true
    })
    setAttachments((prev) => [...prev, ...valid])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Voice message: create a text message, then upload the audio blob as attachment
  const handleVoiceSend = useCallback(async (audioBlob: Blob, durationMs: number) => {
    try {
      const durationSec = Math.ceil(durationMs / 1000)
      const minutes = Math.floor(durationSec / 60)
      const seconds = durationSec % 60
      const durationLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`

      const msg = await onSend(`🎤 ${VOICE_LABELS.voice_message} (${durationLabel})`, [])
      if (!msg?.id) throw new Error('Mensagem não criada')

      const ext = audioBlob.type.includes('webm') ? 'webm' : 'ogg'
      const file = new File([audioBlob], `voice-message-${Date.now()}.${ext}`, {
        type: audioBlob.type,
      })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('processId', processId)
      formData.append('messageId', msg.id)

      const res = await fetch('/api/chat/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || VOICE_LABELS.error)
      }

      toast.success(VOICE_LABELS.sent)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : VOICE_LABELS.error)
    }
  }, [onSend, processId])

  return (
    <div className={cn('space-y-2', editingMessage && 'rounded-xl bg-primary/[0.04] -mx-2 px-2 py-2')}>
      {/* Edit banner (WhatsApp-style) — sobrepõe-se ao reply preview. */}
      {editingMessage && (
        <div className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-3 py-1.5 border-l-2 border-primary">
          <Pencil className="h-3 w-3 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-primary">A editar mensagem</span>
            <p className="text-muted-foreground truncate mt-0.5">{editingMessage.content.slice(0, 80)}</p>
          </div>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && !editingMessage && (
        <div className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-3 py-1.5 border-l-2 border-primary">
          <div className="flex-1 min-w-0">
            <span className="text-muted-foreground">{CHAT_LABELS.reply_to} </span>
            <span className="font-medium">{replyTo.senderName}</span>
            <p className="text-muted-foreground truncate mt-0.5">{replyTo.content.slice(0, 80)}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onCancelReply}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Attachment previews — escondidos em edit mode (não suportamos
          alterar anexos durante edição). Quando hideImageChips=true
          (parent está a render o overlay style WhatsApp), mostramos
          aqui apenas os anexos NÃO-imagem (PDFs, áudios, etc). */}
      {!isRecording && !editingMessage && (() => {
        const visible = hideImageChips
          ? attachments.filter((f) => !f.type.startsWith('image/'))
          : attachments
        if (visible.length === 0) return null
        return (
          <div className="flex flex-wrap gap-2">
            {visible.map((file) => {
              const originalIdx = attachments.indexOf(file)
              return (
                <ChatAttachmentPreview
                  key={`${file.name}-${originalIdx}`}
                  file={file}
                  isUploading={isSubmitting}
                  onRemove={() => setAttachments((prev) => prev.filter((_, idx) => idx !== originalIdx))}
                />
              )
            })}
          </div>
        )
      })()}

      {/* Voice recorder — single instance, always mounted to preserve state.
          When active (recording/preview) it takes full width; when idle it renders just the mic icon. */}
      {isRecording && !editingMessage && (
        <VoiceRecorder
          autoStart
          onSend={handleVoiceSend}
          onCancel={() => setIsRecording(false)}
          disabled={disabled}
        />
      )}

      {/* Text input row — hidden when voice recorder is active */}
      {(!isRecording || editingMessage) && (
        <div className="flex items-end gap-2">
          {/* Edit mode: X cancel à esquerda */}
          {editingMessage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              onClick={onCancelEdit}
              disabled={isSubmitting}
              title="Cancelar edição"
              aria-label="Cancelar edição"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          <div className="flex-1 relative">
            <MentionsInput
              value={value}
              onChange={(_e, newValue) => handleValueChange(newValue)}
              placeholder={editingMessage ? 'Edita a mensagem…' : CHAT_LABELS.placeholder}
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
                  onCancelEdit?.()
                }
              }}
              disabled={disabled || isSubmitting}
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
              <Mention
                trigger="/"
                data={mentionEntities}
                markup="/[__display__](__id__)"
                displayTransform={(_id, display) => `/${display}`}
                style={{
                  backgroundColor: 'hsl(var(--accent) / 0.3)',
                  borderRadius: 4,
                  padding: '1px 2px',
                }}
                renderSuggestion={(suggestion, _search, highlightedDisplay) => {
                  const s = suggestion as { id?: string; type?: string; status?: string; extra?: string }
                  const EntityIcon = s.type === 'task' ? ClipboardList : s.type === 'subtask' ? Pin : FileText
                  const statusColor = s.status === 'completed' ? 'bg-emerald-500' : s.status === 'pending' ? 'bg-slate-400' : 'bg-blue-500'
                  return (
                    <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted">
                      <EntityIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm block truncate">{highlightedDisplay}</span>
                        {s.extra && <span className="text-[10px] text-muted-foreground">{s.extra}</span>}
                      </div>
                      <span className={`h-2 w-2 rounded-full shrink-0 ${statusColor}`} />
                    </div>
                  )
                }}
              />
            </MentionsInput>
          </div>

          {/* Attach + mic escondidos em edit mode */}
          {!editingMessage && (
            <>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isSubmitting}
                title={CHAT_LABELS.attach_file}
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground"
                onClick={() => setIsRecording(true)}
                disabled={disabled || isSubmitting}
                title={VOICE_LABELS.record}
              >
                <Mic className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Send / ✓ verde em edit mode */}
          <Button
            size="icon"
            className={cn(
              'h-9 w-9 shrink-0',
              editingMessage && 'rounded-full bg-emerald-600 hover:bg-emerald-700 text-white',
            )}
            onClick={handleSubmit}
            disabled={!value.trim() || isSubmitting || disabled}
            title={editingMessage ? 'Gravar edição' : CHAT_LABELS.send}
            aria-label={editingMessage ? 'Gravar edição' : CHAT_LABELS.send}
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
  )
}
