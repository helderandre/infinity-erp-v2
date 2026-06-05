'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
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
  MessageSquare,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { ImapMessageEnvelope } from '@/types/email'
import { groupMessagesIntoThreads, type EmailThread } from '@/lib/email/thread-grouping'

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
  onSelectThread?: (thread: EmailThread) => void
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
  onSelectThread,
  onPageChange,
  onRefresh,
  onToggleFlag,
  onSearch,
  onClearSearch,
}: MessageListProps) {
  const [localQuery, setLocalQuery] = useState('')
  const totalPages = Math.ceil(total / limit)

  // Group messages into threads
  const threads = useMemo(() => groupMessagesIntoThreads(messages), [messages])

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
              : `${threads.length} conversa${threads.length !== 1 ? 's' : ''}`}
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

      {/* Threads */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">Nenhuma mensagem nesta pasta.</p>
          </div>
        ) : (
          <div className="divide-y">
            {threads.map((thread) => {
              const latest = thread.latest
              const isSelected = thread.messages.some(m => m.uid === selectedUid)
              const fromName = latest.from[0]?.name || latest.from[0]?.address || 'Desconhecido'
              const dateStr = latest.date
                ? formatDistanceToNow(new Date(latest.date), { addSuffix: true, locale: pt })
                : ''

              return (
                <div
                  key={thread.id}
                  className={cn(
                    'flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors hover:bg-accent/50',
                    isSelected && 'bg-accent',
                    thread.hasUnread && 'bg-primary/[0.03]'
                  )}
                  onClick={() => {
                    if (thread.count > 1 && onSelectThread) {
                      onSelectThread(thread)
                    } else {
                      onSelect(latest.uid)
                    }
                  }}
                >
                  {/* Unread dot */}
                  <div className="pt-1.5 shrink-0 w-2">
                    {thread.hasUnread && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={cn(
                            'text-sm truncate block',
                            thread.hasUnread && 'font-semibold'
                          )}
                        >
                          {fromName}
                        </span>
                        {thread.count > 1 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 shrink-0">
                            <MessageSquare className="h-2.5 w-2.5" />
                            {thread.count}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {dateStr}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span
                        className={cn(
                          'text-sm truncate block',
                          thread.hasUnread ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {latest.subject || '(sem assunto)'}
                      </span>
                      {thread.hasAttachments && (
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Flag — use latest message's UID */}
                  <button
                    className="shrink-0 pt-0.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFlag(latest.uid, !thread.hasFlagged)
                    }}
                  >
                    {thread.hasFlagged ? (
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
