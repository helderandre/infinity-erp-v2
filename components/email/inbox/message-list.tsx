'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import {
  Paperclip,
  Star,
  StarOff,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { ImapMessageEnvelope } from '@/types/email'

interface MessageListProps {
  messages: ImapMessageEnvelope[]
  total: number
  page: number
  limit: number
  isLoading: boolean
  selectedUid: number | null
  searchQuery?: string
  isSearching?: boolean
  onSelect: (uid: number) => void
  onPageChange: (page: number) => void
  onRefresh: () => void
  onToggleFlag: (uid: number, flagged: boolean) => void
  onSearch?: (query: string) => void
  onClearSearch?: () => void
}

export function MessageList({
  messages,
  total,
  page,
  limit,
  isLoading,
  selectedUid,
  searchQuery = '',
  isSearching = false,
  onSelect,
  onPageChange,
  onRefresh,
  onToggleFlag,
  onSearch,
  onClearSearch,
}: MessageListProps) {
  const [localQuery, setLocalQuery] = useState('')
  const totalPages = Math.ceil(total / limit)

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b px-3 py-2 flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-8" />
        </div>
        <div className="flex-1 p-2 space-y-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="border-b px-3 py-2 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {isSearching
              ? `${total} resultado${total !== 1 ? 's' : ''}`
              : `${total} ${total === 1 ? 'mensagem' : 'mensagens'}`}
          </span>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Actualizar</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {onSearch && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onSearch(localQuery)
            }}
            className="relative"
          >
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Pesquisar emails..."
              className="h-8 pl-8 pr-8 text-sm"
            />
            {(localQuery || isSearching) && (
              <button
                type="button"
                title="Limpar pesquisa"
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                onClick={() => {
                  setLocalQuery('')
                  onClearSearch?.()
                }}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">Nenhuma mensagem nesta pasta.</p>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map((msg) => {
              const isRead = msg.flags.includes('\\Seen')
              const isFlagged = msg.flags.includes('\\Flagged')
              const isSelected = msg.uid === selectedUid
              const fromName =
                msg.from[0]?.name || msg.from[0]?.address || 'Desconhecido'
              const dateStr = msg.date
                ? formatDistanceToNow(new Date(msg.date), {
                    addSuffix: true,
                    locale: pt,
                  })
                : ''

              return (
                <div
                  key={msg.uid}
                  className={cn(
                    'flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors hover:bg-accent/50',
                    isSelected && 'bg-accent',
                    !isRead && 'bg-primary/[0.03]'
                  )}
                  onClick={() => onSelect(msg.uid)}
                >
                  {/* Unread dot */}
                  <div className="pt-1.5 shrink-0 w-2">
                    {!isRead && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm truncate block',
                          !isRead && 'font-semibold'
                        )}
                      >
                        {fromName}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {dateStr}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span
                        className={cn(
                          'text-sm truncate block',
                          !isRead ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {msg.subject || '(sem assunto)'}
                      </span>
                      {msg.hasAttachments && (
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Flag */}
                  <button
                    className="shrink-0 pt-0.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFlag(msg.uid, !isFlagged)
                    }}
                  >
                    {isFlagged ? (
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ) : (
                      <StarOff className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t px-3 py-2 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
