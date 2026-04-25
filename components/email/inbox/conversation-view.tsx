'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Reply, Forward, Download, Paperclip, Mail, ArrowLeft,
  Trash2, Archive, FolderInput, UserPlus, Sparkles,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'
import { ContactDialog } from '@/components/leads/contact-dialog'
import { AiReplyDialog } from '@/components/email/ai-reply-dialog'
import type { FullMessage } from '@/hooks/use-email-inbox'
import type { ImapMessageEnvelope } from '@/types/email'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

interface ConversationViewProps {
  threadMessages: ImapMessageEnvelope[]
  folder: string
  accountId?: string | null
  onReply?: (msg: FullMessage) => void
  onForward?: (msg: FullMessage) => void
  onBack?: () => void
  onDelete?: (uid: number) => void
  onArchive?: (uid: number) => void
  onMoveToFolder?: (uid: number) => void
  onSent?: () => void
}

interface LoadedMessage {
  uid: number
  data: FullMessage | null
  loading: boolean
  error: string | null
  collapsed: boolean
}

function MessageBubble({
  msg,
  isLatest,
  collapsed,
  onToggle,
  onReply,
  onForward,
  onDelete,
  onArchive,
  onMoveToFolder,
  accountId,
  onSent,
}: {
  msg: LoadedMessage
  isLatest: boolean
  collapsed: boolean
  onToggle: () => void
  onReply?: (msg: FullMessage) => void
  onForward?: (msg: FullMessage) => void
  onDelete?: (uid: number) => void
  onArchive?: (uid: number) => void
  onMoveToFolder?: (uid: number) => void
  accountId?: string | null
  onSent?: () => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [createLeadOpen, setCreateLeadOpen] = useState(false)
  const [aiReplyOpen, setAiReplyOpen] = useState(false)

  // Render HTML in iframe
  useEffect(() => {
    if (!msg.data?.html || !iframeRef.current || collapsed) return

    const sanitized = DOMPurify.sanitize(msg.data.html, {
      ALLOWED_TAGS: [
        'html', 'head', 'body', 'style', 'div', 'span', 'p', 'br', 'hr',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
        'ul', 'ol', 'li', 'b', 'i', 'u', 'strong', 'em',
        'blockquote', 'pre', 'code', 'font', 'center',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'width', 'height', 'style',
        'class', 'id', 'bgcolor', 'color', 'align', 'valign',
        'cellpadding', 'cellspacing', 'border', 'colspan', 'rowspan',
        'target', 'rel', 'face', 'size',
      ],
      ADD_ATTR: ['target'],
    })

    const doc = iframeRef.current.contentDocument
    if (!doc) return

    doc.open()
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.5; color: #1a1a1a; margin: 0; padding: 12px; word-wrap: break-word; }
        img { max-width: 100%; height: auto; }
        a { color: #2563eb; }
        blockquote { border-left: 3px solid #d1d5db; margin: 8px 0; padding: 4px 12px; color: #6b7280; }
        table { max-width: 100%; }
      </style></head><body>${sanitized}</body></html>`)
    doc.close()

    const resize = () => {
      if (iframeRef.current?.contentDocument?.body) {
        iframeRef.current.style.height = iframeRef.current.contentDocument.body.scrollHeight + 16 + 'px'
      }
    }
    setTimeout(resize, 100)
    setTimeout(resize, 500)
  }, [msg.data?.html, collapsed])

  if (msg.loading) {
    return (
      <div className="rounded-xl border p-4 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (msg.error || !msg.data) {
    return (
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        Erro ao carregar mensagem
      </div>
    )
  }

  const m = msg.data
  const fromStr = m.from[0]?.name || m.from[0]?.address || 'Desconhecido'
  const fromEmail = m.from[0]?.address || ''
  const dateStr = m.date
    ? format(new Date(m.date), "d MMM yyyy 'às' HH:mm", { locale: pt })
    : ''
  const relativeDate = m.date
    ? formatDistanceToNow(new Date(m.date), { addSuffix: true, locale: pt })
    : ''
  const nonInlineAttachments = m.attachments.filter(a => !a.is_inline)

  return (
    <div className={cn('rounded-xl border transition-colors', isLatest ? 'bg-card' : 'bg-card/60')}>
      {/* Header — clickable to collapse/expand */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors rounded-t-xl"
      >
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
          {fromStr.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{fromStr}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{relativeDate}</span>
          </div>
          {collapsed && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {(m.text || '').slice(0, 120)}
            </p>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Body — only shown when expanded */}
      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Meta */}
          <div className="text-[11px] text-muted-foreground mb-3 space-y-0.5">
            <p>De: {fromStr} &lt;{fromEmail}&gt;</p>
            <p>Para: {m.to.map(a => a.name || a.address).join(', ')}</p>
            {m.cc.length > 0 && <p>CC: {m.cc.map(a => a.name || a.address).join(', ')}</p>}
            <p>{dateStr}</p>
          </div>

          {/* Content */}
          {m.html ? (
            <iframe
              ref={iframeRef}
              className="w-full border-0 min-h-[80px]"
              sandbox="allow-same-origin allow-popups"
              title="Email"
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm font-sans">
              {m.text || '(sem conteúdo)'}
            </pre>
          )}

          {/* Attachments */}
          {nonInlineAttachments.length > 0 && (
            <div className="mt-3 pt-3 border-t space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                {nonInlineAttachments.length} {nonInlineAttachments.length === 1 ? 'anexo' : 'anexos'}
              </div>
              <div className="flex flex-wrap gap-2">
                {nonInlineAttachments.map((att, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const blob = Uint8Array.from(atob(att.data_base64), c => c.charCodeAt(0))
                      const url = URL.createObjectURL(new Blob([blob], { type: att.content_type }))
                      const a = document.createElement('a')
                      a.href = url; a.download = att.filename; a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate max-w-[150px]">{att.filename}</span>
                    <span className="text-muted-foreground shrink-0">{formatBytes(att.size_bytes)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions — only on latest message */}
          {isLatest && (
            <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
              {onReply && (
                <Button variant="outline" size="sm" onClick={() => onReply(m)}>
                  <Reply className="h-4 w-4 mr-1.5" /> Responder
                </Button>
              )}
              {onForward && (
                <Button variant="outline" size="sm" onClick={() => onForward(m)}>
                  <Forward className="h-4 w-4 mr-1.5" /> Reencaminhar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setAiReplyOpen(true)}>
                <Sparkles className="h-4 w-4 mr-1.5" /> Resposta IA
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCreateLeadOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1.5" /> Criar Lead
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      {msg.data && (
        <>
          <ContactDialog
            open={createLeadOpen}
            onOpenChange={setCreateLeadOpen}
            defaultValues={{
              nome: m.from[0]?.name || '',
              email: m.from[0]?.address || '',
            }}
          />
          <AiReplyDialog
            open={aiReplyOpen}
            onOpenChange={setAiReplyOpen}
            message={m}
            accountId={accountId}
            onSent={onSent}
          />
        </>
      )}
    </div>
  )
}

export function ConversationView({
  threadMessages,
  folder,
  accountId,
  onReply,
  onForward,
  onBack,
  onDelete,
  onArchive,
  onMoveToFolder,
  onSent,
}: ConversationViewProps) {
  const [loadedMessages, setLoadedMessages] = useState<LoadedMessage[]>([])
  const [sentFolder, setSentFolder] = useState<string | null>(null)

  // Load all messages in the thread (inbox + sent)
  useEffect(() => {
    if (threadMessages.length === 0) return

    // Sort oldest → newest
    const sorted = [...threadMessages].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0
      const db = b.date ? new Date(b.date).getTime() : 0
      return da - db
    })

    // Initialize with inbox messages: all collapsed except the latest
    setLoadedMessages(sorted.map((msg, i) => ({
      uid: msg.uid,
      data: null,
      loading: true,
      error: null,
      collapsed: i < sorted.length - 1,
    })))

    // Helper to fetch a single message
    const fetchMsg = async (uid: number, msgFolder: string) => {
      const params = new URLSearchParams({ folder: msgFolder })
      if (accountId) params.set('account_id', accountId)
      const res = await fetch(`/api/email/inbox/${uid}?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    }

    // Fetch inbox messages
    sorted.forEach(async (msg) => {
      try {
        const data = await fetchMsg(msg.uid, folder)
        setLoadedMessages(prev => prev.map(m =>
          m.uid === msg.uid ? { ...m, data, loading: false } : m
        ))
      } catch (err) {
        setLoadedMessages(prev => prev.map(m =>
          m.uid === msg.uid ? { ...m, loading: false, error: err instanceof Error ? err.message : 'Erro' } : m
        ))
      }
    })

    // Sent message threading disabled for now — only shows inbox messages
    if (false) {
      const params = new URLSearchParams()

      fetch(`/api/email/thread?${params}`)
        .then(r => r.json())
        .then(async (data) => {
          const sentMsgs = (data.messages || []) as ImapMessageEnvelope[]
          const sentFolderName = data.folder as string | undefined
          if (sentFolderName) setSentFolder(sentFolderName)

          if (sentMsgs.length === 0) return

          // Filter out messages already in the inbox thread (by messageId)
          const existingIds = new Set(sorted.map(m => m.messageId).filter(Boolean))
          const newSentMsgs = sentMsgs.filter(m => m.messageId && !existingIds.has(m.messageId))

          if (newSentMsgs.length === 0) return

          // Add sent messages to the loaded list, inserted chronologically
          const sentLoaded: LoadedMessage[] = newSentMsgs.map(m => ({
            uid: m.uid,
            data: null,
            loading: true,
            error: null,
            collapsed: true,
          }))

          setLoadedMessages(prev => {
            const combined = [...prev, ...sentLoaded]
            // Re-sort by date once we have the data — for now just append
            return combined
          })

          // Fetch full content of each sent message
          for (const msg of newSentMsgs) {
            try {
              const msgData = await fetchMsg(msg.uid, sentFolderName || 'Sent')
              setLoadedMessages(prev => {
                const updated = prev.map(m =>
                  m.uid === msg.uid && !m.data ? { ...m, data: msgData, loading: false } : m
                )
                // Sort by date now that we have data
                return updated.sort((a, b) => {
                  const da = a.data?.date ? new Date(a.data.date).getTime() : 0
                  const db = b.data?.date ? new Date(b.data.date).getTime() : 0
                  return da - db
                })
              })
            } catch {
              setLoadedMessages(prev => prev.map(m =>
                m.uid === msg.uid && !m.data ? { ...m, loading: false, error: 'Erro' } : m
              ))
            }
          }

          // Uncollapse the last message (which may now be a sent one)
          setLoadedMessages(prev => {
            const last = prev.length - 1
            return prev.map((m, i) => i === last ? { ...m, collapsed: false } : m)
          })
        })
        .catch(() => { /* silent — sent search is best-effort */ })
    }
  }, [threadMessages, folder, accountId])

  const toggleCollapse = useCallback((uid: number) => {
    setLoadedMessages(prev => prev.map(m =>
      m.uid === uid ? { ...m, collapsed: !m.collapsed } : m
    ))
  }, [])

  if (threadMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Mail className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm">Seleccione uma conversa para ler</p>
      </div>
    )
  }

  const subject = threadMessages[0]?.subject || '(sem assunto)'
  const latestUid = loadedMessages.length > 0 ? loadedMessages[loadedMessages.length - 1].uid : null

  return (
    <ScrollArea className="h-full" data-no-long-press>
      <div className="p-4 sm:p-6 space-y-3">
        {/* Back button (mobile) */}
        {onBack && (
          <Button variant="ghost" size="sm" className="mb-1 -ml-2 gap-1 sm:hidden" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        )}

        {/* Thread subject */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-lg font-semibold leading-tight">{subject}</h2>
          <span className="text-xs text-muted-foreground shrink-0 bg-muted px-2 py-0.5 rounded-full">
            {threadMessages.length} {threadMessages.length === 1 ? 'mensagem' : 'mensagens'}
          </span>
        </div>

        {/* Thread actions */}
        <div className="flex items-center gap-1.5 mb-2">
          {onArchive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => latestUid && onArchive(latestUid)}>
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Arquivar</TooltipContent>
            </Tooltip>
          )}
          {onMoveToFolder && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => latestUid && onMoveToFolder(latestUid)}>
                  <FolderInput className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mover</TooltipContent>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => latestUid && onDelete(latestUid)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Eliminar</TooltipContent>
            </Tooltip>
          )}
        </div>

        <Separator />

        {/* Stacked messages */}
        <div className="space-y-2 pt-2">
          {loadedMessages.map((msg) => (
            <MessageBubble
              key={msg.uid}
              msg={msg}
              isLatest={msg.uid === latestUid}
              collapsed={msg.collapsed}
              onToggle={() => toggleCollapse(msg.uid)}
              onReply={onReply}
              onForward={onForward}
              onDelete={onDelete}
              onArchive={onArchive}
              onMoveToFolder={onMoveToFolder}
              accountId={accountId}
              onSent={onSent}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
