# PRD-03: Frontend Components & UI

> WhatsApp Web — Componentes de interface para o sistema de mensagens
> Projecto: ERP Infinity v2 | Data: 2026-03-18

---

## 1. Estrutura de Páginas e Componentes

```
app/dashboard/whatsapp/
├── page.tsx                              ← Página principal (chat list + thread)
├── layout.tsx                            ← Layout sem padding (full-height)
└── contactos/page.tsx                    ← Gestão de contactos

components/whatsapp/
├── chat-layout.tsx                       ← Layout 3 painéis (sidebar + thread + info)
├── chat-sidebar.tsx                      ← Lista de chats (esquerda)
├── chat-list-item.tsx                    ← Item individual na lista de chats
├── chat-thread.tsx                       ← Área de mensagens (centro)
├── chat-header.tsx                       ← Header do chat activo (nome, avatar, acções)
├── chat-input.tsx                        ← Input de mensagem (texto, media, áudio, emoji)
├── chat-info-panel.tsx                   ← Painel de info do contacto (direita)
├── message-bubble.tsx                    ← Bolha de mensagem individual
├── message-status.tsx                    ← Ticks de status (✓ ✓✓ azul)
├── message-reactions.tsx                 ← Reacções numa mensagem
├── message-quoted.tsx                    ← Preview de mensagem citada
├── message-media-renderer.tsx            ← Renderizador de media (imagem, vídeo, áudio, doc)
├── message-context-menu.tsx              ← Menu de contexto (responder, reagir, apagar, reencaminhar)
├── media-preview-modal.tsx               ← Modal fullscreen para imagens/vídeos
├── audio-player.tsx                      ← Player de áudio inline (waveform)
├── contact-card.tsx                      ← Card de contacto com vinculação
├── contact-link-dialog.tsx               ← Dialog para vincular a owner/lead
├── instance-selector.tsx                 ← Selector de instância WhatsApp
├── typing-indicator.tsx                  ← "A escrever..." animado
├── emoji-picker.tsx                      ← Picker de emojis (para reacções e texto)
├── search-messages.tsx                   ← Pesquisa dentro de mensagens
└── empty-chat-state.tsx                  ← Estado vazio quando nenhum chat está seleccionado
```

---

## 2. Layout Principal — `chat-layout.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│ Sidebar ERP │ Chat Sidebar    │ Chat Thread          │ Info     │
│ (existente) │ ┌─────────────┐ │ ┌──────────────────┐ │ Panel   │
│             │ │ Instance ▾  │ │ │ Chat Header      │ │ ┌─────┐ │
│             │ │ 🔍 Pesquisar│ │ │ Nome + Avatar    │ │ │Cont.│ │
│             │ ├─────────────┤ │ ├──────────────────┤ │ │Info │ │
│             │ │ Chat 1      │ │ │                  │ │ │     │ │
│             │ │ Chat 2 (2)  │ │ │  Mensagens       │ │ │Tags │ │
│             │ │ Chat 3      │ │ │  (scroll)        │ │ │     │ │
│             │ │ ...         │ │ │                  │ │ │Media│ │
│             │ │             │ │ │                  │ │ │     │ │
│             │ │             │ │ ├──────────────────┤ │ │     │ │
│             │ │             │ │ │ Chat Input       │ │ └─────┘ │
│             │ └─────────────┘ │ └──────────────────┘ │         │
└─────────────────────────────────────────────────────────────────┘
     240px         320px          flex-1                  320px
```

```tsx
// components/whatsapp/chat-layout.tsx
'use client'

import { useState } from 'react'
import { ChatSidebar } from './chat-sidebar'
import { ChatThread } from './chat-thread'
import { ChatInfoPanel } from './chat-info-panel'
import { EmptyChatState } from './empty-chat-state'

interface ChatLayoutProps {
  instances: Array<{ id: string; name: string; connection_status: string }>
}

export function ChatLayout({ instances }: ChatLayoutProps) {
  const [selectedInstance, setSelectedInstance] = useState(instances[0]?.id || '')
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Chat List Sidebar */}
      <div className="w-80 border-r flex-shrink-0">
        <ChatSidebar
          instances={instances}
          selectedInstance={selectedInstance}
          onInstanceChange={setSelectedInstance}
          selectedChatId={selectedChatId}
          onChatSelect={setSelectedChatId}
        />
      </div>

      {/* Chat Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedChatId ? (
          <ChatThread
            chatId={selectedChatId}
            onToggleInfo={() => setShowInfo(!showInfo)}
          />
        ) : (
          <EmptyChatState />
        )}
      </div>

      {/* Info Panel */}
      {showInfo && selectedChatId && (
        <div className="w-80 border-l flex-shrink-0 overflow-y-auto">
          <ChatInfoPanel chatId={selectedChatId} onClose={() => setShowInfo(false)} />
        </div>
      )}
    </div>
  )
}
```

---

## 3. Componentes Principais

### 3.1 `chat-sidebar.tsx` — Lista de chats

```tsx
// Padrão: lista ordenada por last_message_timestamp DESC
// Funcionalidades:
// - Selector de instância (dropdown no topo)
// - Campo de pesquisa com debounce 300ms
// - Lista de chats com:
//   - Avatar (imagem do contacto ou iniciais)
//   - Nome
//   - Última mensagem (truncada)
//   - Hora da última mensagem (formatada: "14:30", "Ontem", "12 Mar")
//   - Badge de unread_count
//   - Ícone de pin/archive
// - Tabs: Todos | Não lidos | Grupos
// - Chat seleccionado destacado com bg-accent

// Exemplo de formatação de data (padrão ERP):
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import { pt } from 'date-fns/locale'

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp)
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Ontem'
  return format(date, 'dd/MM/yyyy')
}
```

### 3.2 `message-bubble.tsx` — Bolha de mensagem

```tsx
// components/whatsapp/message-bubble.tsx
'use client'

import { cn } from '@/lib/utils'
import { MessageStatus } from './message-status'
import { MessageReactions } from './message-reactions'
import { MessageQuoted } from './message-quoted'
import { MessageMediaRenderer } from './message-media-renderer'
import type { WppMessage, WppReaction } from '@/lib/types/whatsapp-web'

interface MessageBubbleProps {
  message: WppMessage
  quotedMessage?: {
    text: string
    message_type: string
    sender_name: string
    from_me: boolean
    media_url: string
  } | null
  onReply: () => void
  onReact: (emoji: string) => void
  onDelete: () => void
  onForward: () => void
  showSenderName?: boolean // Para grupos
}

export function MessageBubble({
  message,
  quotedMessage,
  onReply,
  onReact,
  onDelete,
  onForward,
  showSenderName,
}: MessageBubbleProps) {
  const isMe = message.from_me
  const isDeleted = message.is_deleted

  return (
    <div className={cn(
      'flex mb-1 px-4',
      isMe ? 'justify-end' : 'justify-start'
    )}>
      <div className={cn(
        'max-w-[65%] rounded-lg px-3 py-1.5 relative group',
        isMe
          ? 'bg-emerald-100 dark:bg-emerald-900/30'
          : 'bg-white dark:bg-zinc-800',
        'shadow-sm'
      )}>
        {/* Sender name (grupos) */}
        {showSenderName && !isMe && (
          <p className="text-xs font-medium text-primary mb-0.5">
            {message.sender_name || message.sender}
          </p>
        )}

        {/* Mensagem citada */}
        {quotedMessage && !isDeleted && (
          <MessageQuoted quoted={quotedMessage} />
        )}

        {/* Forwarded indicator */}
        {message.is_forwarded && !isDeleted && (
          <p className="text-xs text-muted-foreground italic mb-0.5">
            ↗ Reencaminhada
          </p>
        )}

        {/* Conteúdo */}
        {isDeleted ? (
          <p className="text-sm italic text-muted-foreground">
            🚫 Esta mensagem foi apagada
          </p>
        ) : (
          <>
            {/* Media */}
            {message.message_type !== 'text' && (
              <MessageMediaRenderer message={message} />
            )}

            {/* Texto */}
            {message.text && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.text}
              </p>
            )}
          </>
        )}

        {/* Footer: hora + status */}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
          {isMe && <MessageStatus status={message.status} />}
        </div>

        {/* Reacções */}
        {message.reactions?.length > 0 && (
          <MessageReactions
            reactions={message.reactions}
            onReact={onReact}
          />
        )}

        {/* Context menu trigger (hover) */}
        {/* ... botão ▾ que abre o menu de contexto */}
      </div>
    </div>
  )
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
```

### 3.3 `message-status.tsx` — Ticks de status

```tsx
// components/whatsapp/message-status.tsx
import { Check, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WppMessageStatus } from '@/lib/types/whatsapp-web'

interface MessageStatusProps {
  status: WppMessageStatus
}

export function MessageStatus({ status }: MessageStatusProps) {
  switch (status) {
    case 'sent':
      return <Check className="h-3.5 w-3.5 text-muted-foreground" />
    case 'delivered':
      return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
    case 'read':
    case 'played':
      return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
    case 'failed':
      return <span className="text-[10px] text-red-500">!</span>
    default:
      return null
  }
}

// Tooltip: "Enviada", "Entregue", "Lida", "Reproduzida"
```

### 3.4 `message-media-renderer.tsx` — Renderizador de media

```tsx
// components/whatsapp/message-media-renderer.tsx
'use client'

import { useState } from 'react'
import { Play, FileText, Download, MapPin, User } from 'lucide-react'
import { AudioPlayer } from './audio-player'
import { MediaPreviewModal } from './media-preview-modal'
import type { WppMessage } from '@/lib/types/whatsapp-web'

interface Props {
  message: WppMessage
}

export function MessageMediaRenderer({ message }: Props) {
  const [showPreview, setShowPreview] = useState(false)

  switch (message.message_type) {
    case 'image':
      return (
        <>
          <div
            className="cursor-pointer rounded overflow-hidden mb-1"
            onClick={() => setShowPreview(true)}
          >
            <img
              src={message.media_url}
              alt="Imagem"
              className="max-w-full max-h-[300px] object-cover"
              loading="lazy"
            />
          </div>
          {showPreview && (
            <MediaPreviewModal
              url={message.media_url}
              type="image"
              onClose={() => setShowPreview(false)}
            />
          )}
        </>
      )

    case 'video':
      return (
        <div className="relative rounded overflow-hidden mb-1 max-w-[300px]">
          <video
            src={message.media_url}
            controls
            preload="metadata"
            className="max-w-full max-h-[300px]"
          />
          {message.media_duration && (
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
              {formatDuration(message.media_duration)}
            </span>
          )}
        </div>
      )

    case 'audio':
      return (
        <AudioPlayer
          src={message.media_url}
          duration={message.media_duration || 0}
        />
      )

    case 'document':
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 rounded bg-muted/50 hover:bg-muted transition-colors mb-1"
        >
          <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {message.media_file_name || 'Documento'}
            </p>
            {message.media_file_size && (
              <p className="text-xs text-muted-foreground">
                {formatFileSize(message.media_file_size)}
              </p>
            )}
          </div>
          <Download className="h-4 w-4 text-muted-foreground" />
        </a>
      )

    case 'sticker':
      return (
        <img
          src={message.media_url}
          alt="Sticker"
          className="max-w-[180px] max-h-[180px]"
        />
      )

    case 'location':
      return (
        <a
          href={`https://maps.google.com/?q=${message.latitude},${message.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 rounded bg-muted/50 hover:bg-muted transition-colors mb-1"
        >
          <MapPin className="h-6 w-6 text-red-500" />
          <div>
            <p className="text-sm font-medium">
              {message.location_name || 'Localização'}
            </p>
            <p className="text-xs text-muted-foreground">
              {message.latitude?.toFixed(5)}, {message.longitude?.toFixed(5)}
            </p>
          </div>
        </a>
      )

    case 'contact':
      return (
        <div className="flex items-center gap-2 p-2 rounded bg-muted/50 mb-1">
          <User className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{message.text || 'Contacto'}</p>
          </div>
        </div>
      )

    default:
      return null
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}
```

### 3.5 `chat-input.tsx` — Input de mensagem

```tsx
// components/whatsapp/chat-input.tsx
// Funcionalidades:
// - Textarea expansível (1-5 linhas)
// - Botão de enviar (Enter = enviar, Shift+Enter = nova linha)
// - Botão de anexar ficheiro (dropdown: Imagem, Vídeo, Documento)
// - Botão de gravar áudio (hold para gravar, release para enviar)
// - Botão de emoji (abrir picker)
// - Preview de resposta (quando a responder a uma mensagem)
// - Preview de ficheiro (quando um ficheiro é seleccionado)
// - Enviar presença "composing" enquanto digita (debounce 2s)

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Paperclip, Mic, Smile, X, Image, FileText, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ChatInputProps {
  onSendText: (text: string, replyId?: string) => Promise<void>
  onSendMedia: (file: File, type: string, caption?: string, replyId?: string) => Promise<void>
  onSendPresence: (type: 'composing' | 'paused') => void
  replyTo?: { id: string; text: string; senderName: string } | null
  onCancelReply?: () => void
  disabled?: boolean
}

export function ChatInput({
  onSendText,
  onSendMedia,
  onSendPresence,
  replyTo,
  onCancelReply,
  disabled,
}: ChatInputProps) {
  const [text, setText] = useState('')
  const [selectedFile, setSelectedFile] = useState<{ file: File; type: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const presenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(async () => {
    if (selectedFile) {
      await onSendMedia(selectedFile.file, selectedFile.type, text || undefined, replyTo?.id)
      setSelectedFile(null)
    } else if (text.trim()) {
      await onSendText(text.trim(), replyTo?.id)
    }
    setText('')
    onCancelReply?.()
    textareaRef.current?.focus()
  }, [text, selectedFile, replyTo, onSendText, onSendMedia, onCancelReply])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextChange = (value: string) => {
    setText(value)
    // Enviar presença "composing"
    onSendPresence('composing')
    if (presenceTimeoutRef.current) clearTimeout(presenceTimeoutRef.current)
    presenceTimeoutRef.current = setTimeout(() => {
      onSendPresence('paused')
    }, 2000)
  }

  const handleFileSelect = (type: string) => {
    if (!fileInputRef.current) return
    const accept: Record<string, string> = {
      image: 'image/*',
      video: 'video/*',
      document: '*/*',
    }
    fileInputRef.current.accept = accept[type] || '*/*'
    fileInputRef.current.setAttribute('data-type', type)
    fileInputRef.current.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const type = e.target.getAttribute('data-type') || 'document'
    if (file) {
      setSelectedFile({ file, type })
    }
    e.target.value = ''
  }

  return (
    <div className="border-t bg-background p-3">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg border-l-4 border-primary">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">{replyTo.senderName}</p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.text}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelReply}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* File preview */}
      {selectedFile && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg">
          <FileText className="h-5 w-5 text-blue-500" />
          <span className="text-sm truncate flex-1">{selectedFile.file.name}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedFile(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Button variant="ghost" size="icon" className="flex-shrink-0">
          <Smile className="h-5 w-5 text-muted-foreground" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <Paperclip className="h-5 w-5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleFileSelect('image')}>
              <Image className="mr-2 h-4 w-4" /> Imagem
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFileSelect('video')}>
              <Video className="mr-2 h-4 w-4" /> Vídeo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFileSelect('document')}>
              <FileText className="mr-2 h-4 w-4" /> Documento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escrever mensagem..."
          className="flex-1 min-h-[40px] max-h-[120px] resize-none"
          rows={1}
          disabled={disabled}
        />

        {text.trim() || selectedFile ? (
          <Button
            size="icon"
            className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSend}
            disabled={disabled}
          >
            <Send className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="flex-shrink-0">
            <Mic className="h-5 w-5 text-muted-foreground" />
          </Button>
        )}
      </div>

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
    </div>
  )
}
```

### 3.6 `message-quoted.tsx` — Mensagem citada

```tsx
// components/whatsapp/message-quoted.tsx
import { cn } from '@/lib/utils'
import { Image, FileText, Mic, Video, MapPin, Sticker } from 'lucide-react'

interface Props {
  quoted: {
    text: string
    message_type: string
    sender_name: string
    from_me: boolean
    media_url: string
  }
}

export function MessageQuoted({ quoted }: Props) {
  const typeIcons: Record<string, React.ReactNode> = {
    image: <Image className="h-3 w-3" />,
    video: <Video className="h-3 w-3" />,
    audio: <Mic className="h-3 w-3" />,
    document: <FileText className="h-3 w-3" />,
    location: <MapPin className="h-3 w-3" />,
    sticker: <Sticker className="h-3 w-3" />,
  }

  const typeLabels: Record<string, string> = {
    image: 'Imagem',
    video: 'Vídeo',
    audio: 'Áudio',
    document: 'Documento',
    location: 'Localização',
    sticker: 'Sticker',
  }

  return (
    <div className="border-l-4 border-primary/50 bg-muted/50 rounded p-1.5 mb-1 cursor-pointer">
      <p className="text-xs font-medium text-primary">
        {quoted.from_me ? 'Você' : quoted.sender_name}
      </p>
      <div className="flex items-center gap-1">
        {typeIcons[quoted.message_type]}
        <p className="text-xs text-muted-foreground truncate">
          {quoted.text || typeLabels[quoted.message_type] || ''}
        </p>
      </div>
      {/* Thumbnail para imagens/vídeos */}
      {quoted.media_url && (quoted.message_type === 'image' || quoted.message_type === 'video') && (
        <img
          src={quoted.media_url}
          alt=""
          className="w-10 h-10 rounded object-cover mt-1"
        />
      )}
    </div>
  )
}
```

### 3.7 `message-reactions.tsx` — Reacções

```tsx
// components/whatsapp/message-reactions.tsx

interface Props {
  reactions: Array<{ emoji: string; sender: string; from_me: boolean }>
  onReact: (emoji: string) => void
}

export function MessageReactions({ reactions, onReact }: Props) {
  // Agrupar reacções por emoji
  const grouped = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, hasMine: false }
    acc[r.emoji].count++
    if (r.from_me) acc[r.emoji].hasMine = true
    return acc
  }, {} as Record<string, { emoji: string; count: number; hasMine: boolean }>)

  return (
    <div className="flex flex-wrap gap-1 -mb-2 mt-1">
      {Object.values(grouped).map(({ emoji, count, hasMine }) => (
        <button
          key={emoji}
          onClick={() => onReact(hasMine ? '' : emoji)} // Toggle
          className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs',
            'border transition-colors',
            hasMine
              ? 'bg-primary/10 border-primary/30'
              : 'bg-muted border-transparent hover:border-muted-foreground/20'
          )}
        >
          <span>{emoji}</span>
          {count > 1 && <span className="text-muted-foreground">{count}</span>}
        </button>
      ))}
    </div>
  )
}
```

### 3.8 `audio-player.tsx` — Player de áudio

```tsx
// components/whatsapp/audio-player.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

interface Props {
  src: string
  duration: number
}

export function AudioPlayer({ src, duration }: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(duration)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setAudioDuration(audio.duration)
      }
    }
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0) }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const toggle = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const seek = (value: number[]) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = value[0]
    setCurrentTime(value[0])
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center gap-2 min-w-[200px] py-1">
      <audio ref={audioRef} src={src} preload="metadata" />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={toggle}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </Button>
      <div className="flex-1">
        <Slider
          value={[currentTime]}
          max={audioDuration || 1}
          step={0.1}
          onValueChange={seek}
          className="h-1"
        />
      </div>
      <span className="text-xs text-muted-foreground w-10 text-right">
        {formatTime(isPlaying ? currentTime : audioDuration)}
      </span>
    </div>
  )
}
```

### 3.9 `typing-indicator.tsx`

```tsx
// components/whatsapp/typing-indicator.tsx
export function TypingIndicator({ name }: { name?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1">
      <div className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-muted-foreground italic">
        {name ? `${name} está a escrever...` : 'A escrever...'}
      </span>
    </div>
  )
}
```

### 3.10 `chat-info-panel.tsx` — Painel de informação

```tsx
// Painel lateral direito com:
// - Avatar grande + nome + telefone
// - Botões: Áudio, Vídeo, Pesquisar
// - Secção "Vinculação ERP":
//   - Se vinculado a Owner: Tag com nome + badge dos imóveis associados
//   - Se vinculado a Lead: Tag com nome + status + negócios
//   - Botão "Vincular" que abre dialog de pesquisa owner/lead
// - Secção "Media" — galeria de imagens/vídeos do chat
// - Secção "Documentos" — lista de documentos partilhados
// - Secção "Links" — links partilhados
// - Etiquetas (labels) do WhatsApp Business

// Tags de vinculação ERP:
// Owner → Mostrar: nome, imóveis (dev_properties), processos (proc_instances)
// Lead → Mostrar: nome, status, negócios (negocios), score

// Exemplo de query para tags de owner:
// SELECT owners.*,
//   (SELECT json_agg(json_build_object('id', p.id, 'title', p.title, 'status', p.status))
//    FROM property_owners po JOIN dev_properties p ON p.id = po.property_id
//    WHERE po.owner_id = owners.id) as properties,
//   (SELECT json_agg(json_build_object('id', pi.id, 'external_ref', pi.external_ref, 'current_status', pi.current_status))
//    FROM proc_instances pi JOIN dev_properties p ON p.id = pi.property_id
//    JOIN property_owners po ON po.property_id = p.id
//    WHERE po.owner_id = owners.id) as processes
// FROM owners WHERE id = $1
```

---

## 4. Página Principal

```tsx
// app/dashboard/whatsapp/page.tsx
import { createClient } from '@/lib/supabase/server'
import { ChatLayout } from '@/components/whatsapp/chat-layout'

export default async function WhatsAppPage() {
  const supabase = await createClient()

  // Buscar instâncias conectadas
  const { data: instances } = await (supabase as any)
    .from('auto_wpp_instances')
    .select('id, name, connection_status, phone, profile_name, profile_pic_url')
    .eq('status', 'active')
    .order('name')

  return <ChatLayout instances={instances || []} />
}
```

```tsx
// app/dashboard/whatsapp/layout.tsx
export default function WhatsAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full -m-4"> {/* Remove padding do layout dashboard */}
      {children}
    </div>
  )
}
```

---

## 5. Sidebar — Adicionar Módulo WhatsApp

Adicionar ao `components/layout/app-sidebar.tsx`:

```tsx
// Na secção de automações ou como grupo separado:
{
  title: "WhatsApp Web",
  url: "/dashboard/whatsapp",
  icon: MessageCircle, // de lucide-react
  // Ou usar ícone SVG do WhatsApp
}
```

---

## 6. Dependências Necessárias

```bash
# Já instaladas no projecto:
# - shadcn/ui (button, input, textarea, dialog, dropdown-menu, slider, tabs, badge, avatar, popover)
# - lucide-react
# - date-fns
# - framer-motion (opcional, para animações)

# Potencialmente necessárias:
# - emoji-mart (picker de emojis) — ou usar emoji-picker-react
# - wavesurfer.js (waveform visual para áudio) — opcional, slider é suficiente
```

---

## 7. Padrões de Referência do Codebase

### Layout sem padding para WhatsApp Web
- Similar ao chat dos processos que ocupa full height
- Remover margins/padding do layout do dashboard para a página do WhatsApp

### Componentes shadcn já instalados e úteis
- `Avatar` — para avatares nos chats
- `Badge` — para unread count, tags de vinculação
- `Button` — todos os botões
- `Dialog` — para modais de vinculação, preview de media
- `DropdownMenu` — para menus de contexto e attach
- `Input` — pesquisa
- `Popover` — emoji picker
- `ScrollArea` — para listas com scroll
- `Select` — selector de instância
- `Separator` — divisores
- `Skeleton` — loading states
- `Slider` — player de áudio
- `Tabs` — filtros na sidebar
- `Textarea` — input de mensagem
- `Tooltip` — tooltips em ícones

### Realtime pattern (de `hooks/use-chat-messages.ts`)
- Channel subscription no useEffect
- Cleanup no return
- Optimistic updates com deduplicação
