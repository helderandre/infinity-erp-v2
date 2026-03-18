'use client'

import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Reply,
  Forward,
  Download,
  Paperclip,
  Mail,
  ArrowLeft,
  Trash2,
  Archive,
  FolderInput,
} from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import DOMPurify from 'dompurify'
import type { FullMessage } from '@/hooks/use-email-inbox'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

interface MessageViewProps {
  message: FullMessage | null
  isLoading: boolean
  error: string | null
  onReply?: (msg: FullMessage) => void
  onForward?: (msg: FullMessage) => void
  onBack?: () => void
  onDelete?: (uid: number) => void
  onArchive?: (uid: number) => void
  onMoveToFolder?: (uid: number) => void
}

export function MessageView({
  message,
  isLoading,
  error,
  onReply,
  onForward,
  onBack,
  onDelete,
  onArchive,
  onMoveToFolder,
}: MessageViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Render HTML safely in iframe
  useEffect(() => {
    if (!message?.html || !iframeRef.current) return

    const sanitized = DOMPurify.sanitize(message.html, {
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
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <base target="_blank">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #1a1a1a;
            margin: 0;
            padding: 16px;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          img { max-width: 100%; height: auto; }
          a { color: #2563eb; }
          blockquote {
            border-left: 3px solid #d1d5db;
            margin: 8px 0;
            padding: 4px 12px;
            color: #6b7280;
          }
          table { max-width: 100%; }
        </style>
      </head>
      <body>${sanitized}</body>
      </html>
    `)
    doc.close()

    // Auto-resize iframe to content
    const resize = () => {
      if (iframeRef.current?.contentDocument?.body) {
        iframeRef.current.style.height =
          iframeRef.current.contentDocument.body.scrollHeight + 32 + 'px'
      }
    }
    setTimeout(resize, 100)
    setTimeout(resize, 500)
  }, [message?.html])

  if (!message && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Mail className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm">Seleccione uma mensagem para ler</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (!message) return null

  const fromStr =
    message.from[0]?.name
      ? `${message.from[0].name} <${message.from[0].address}>`
      : message.from[0]?.address || 'Desconhecido'

  const toStr = message.to
    .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
    .join(', ')

  const ccStr =
    message.cc.length > 0
      ? message.cc
          .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
          .join(', ')
      : null

  const dateStr = message.date
    ? format(new Date(message.date), "d 'de' MMMM 'de' yyyy 'às' HH:mm", {
        locale: pt,
      })
    : ''

  const nonInlineAttachments = message.attachments.filter((a) => !a.is_inline)

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6">
        {/* Back button (mobile) */}
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 gap-1 sm:hidden"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        )}

        {/* Subject */}
        <h2 className="text-xl font-semibold mb-3">{message.subject}</h2>

        {/* From / To / CC / Date */}
        <div className="space-y-1 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground shrink-0 w-8">De:</span>
            <span className="font-medium">{fromStr}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground shrink-0 w-8">Para:</span>
            <span>{toStr}</span>
          </div>
          {ccStr && (
            <div className="flex items-baseline gap-2">
              <span className="text-muted-foreground shrink-0 w-8">CC:</span>
              <span>{ccStr}</span>
            </div>
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground shrink-0 w-8">Data:</span>
            <span className="text-muted-foreground">{dateStr}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {onReply && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReply(message)}
                >
                  <Reply className="h-4 w-4 mr-1.5" />
                  Responder
                </Button>
              </TooltipTrigger>
              <TooltipContent>Responder ao remetente</TooltipContent>
            </Tooltip>
          )}
          {onForward && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onForward(message)}
                >
                  <Forward className="h-4 w-4 mr-1.5" />
                  Reencaminhar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reencaminhar mensagem</TooltipContent>
            </Tooltip>
          )}

          <div className="h-4 w-px bg-border mx-1" />

          {onArchive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onArchive(message.uid)}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Arquivar</TooltipContent>
            </Tooltip>
          )}
          {onMoveToFolder && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onMoveToFolder(message.uid)}
                >
                  <FolderInput className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mover para pasta</TooltipContent>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(message.uid)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Eliminar</TooltipContent>
            </Tooltip>
          )}
        </div>

        <Separator className="my-4" />

        {/* Body */}
        {message.html ? (
          <iframe
            ref={iframeRef}
            className="w-full border-0 min-h-[200px]"
            sandbox="allow-same-origin allow-popups"
            title="Conteúdo do email"
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm font-sans">
            {message.text || '(sem conteúdo)'}
          </pre>
        )}

        {/* Attachments */}
        {nonInlineAttachments.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Paperclip className="h-4 w-4" />
                {nonInlineAttachments.length}{' '}
                {nonInlineAttachments.length === 1 ? 'anexo' : 'anexos'}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {nonInlineAttachments.map((att, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {att.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(att.size_bytes)}
                      </p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8"
                          onClick={() => {
                            const blob = Uint8Array.from(
                              atob(att.data_base64),
                              (c) => c.charCodeAt(0)
                            )
                            const url = URL.createObjectURL(
                              new Blob([blob], { type: att.content_type })
                            )
                            const a = document.createElement('a')
                            a.href = url
                            a.download = att.filename
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Transferir</TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  )
}
