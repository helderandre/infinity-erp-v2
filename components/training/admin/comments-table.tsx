// @ts-nocheck
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  MessageSquare, CheckCircle2, Circle, Send, Loader2,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { useTrainingAdminComments } from '@/hooks/use-training-admin-comments'
import { formatDateTime } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const PAGE_SIZE = 20

const RESOLVED_TABS = [
  { key: '', label: 'Todos' },
  { key: 'false', label: 'Não Resolvidos' },
  { key: 'true', label: 'Resolvidos' },
] as const

interface CommentsTableProps {
  courseId?: string
}

export function CommentsTable({ courseId }: CommentsTableProps) {
  const [resolvedFilter, setResolvedFilter] = useState('')
  const [page, setPage] = useState(1)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())

  const { comments, total, isLoading, replyToComment, toggleResolved } = useTrainingAdminComments({
    isResolved: resolvedFilter || undefined,
    courseId,
    page,
    limit: PAGE_SIZE,
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleReply = async (commentId: string) => {
    if (!replyContent.trim()) return
    setIsReplying(true)
    try {
      const comment = comments.find(c => c.id === commentId)
      if (!comment) return
      await replyToComment(commentId, replyContent.trim(), comment.course_id!, comment.lesson_id)
      toast.success('Resposta enviada')
      setReplyingTo(null)
      setReplyContent('')
    } catch {
      toast.error('Erro ao enviar resposta')
    } finally {
      setIsReplying(false)
    }
  }

  const handleToggleResolved = async (commentId: string) => {
    try {
      await toggleResolved(commentId)
      toast.success('Estado actualizado')
    } catch {
      toast.error('Erro ao actualizar estado')
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
        {RESOLVED_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setResolvedFilter(tab.key); setPage(1) }}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-300',
              resolvedFilter === tab.key
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Comment list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nenhum comentário encontrado"
          description="Não existem comentários com os critérios seleccionados."
        />
      ) : (
        <>
          <div className="space-y-3">
            {comments.map((comment) => {
              const hasReplies = comment.replies && comment.replies.length > 0
              const isExpanded = expandedReplies.has(comment.id)

              return (
                <div key={comment.id} className="rounded-xl border bg-card/30 backdrop-blur-sm p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {(comment.user_name || '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{comment.user_name || 'Utilizador'}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(comment.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {comment.lesson_title && (
                        <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5">
                          {comment.lesson_title}
                        </Badge>
                      )}
                      {comment.course_title && (
                        <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5 text-muted-foreground">
                          {comment.course_title}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <p className="text-sm">{comment.content}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    >
                      <MessageSquare className="mr-1 h-3 w-3" />
                      Responder
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn('h-7 text-xs', comment.is_resolved && 'text-emerald-600')}
                      onClick={() => handleToggleResolved(comment.id)}
                    >
                      {comment.is_resolved ? (
                        <><CheckCircle2 className="mr-1 h-3 w-3" /> Resolvido</>
                      ) : (
                        <><Circle className="mr-1 h-3 w-3" /> Marcar resolvido</>
                      )}
                    </Button>
                    {hasReplies && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => toggleExpanded(comment.id)}
                      >
                        {isExpanded ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
                        {comment.replies!.length} resposta{comment.replies!.length !== 1 ? 's' : ''}
                      </Button>
                    )}
                  </div>

                  {/* Inline reply form */}
                  {replyingTo === comment.id && (
                    <div className="flex gap-2 pt-1">
                      <Textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Escrever resposta..."
                        rows={2}
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        className="shrink-0"
                        disabled={!replyContent.trim() || isReplying}
                        onClick={() => handleReply(comment.id)}
                      >
                        {isReplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  )}

                  {/* Replies */}
                  {hasReplies && isExpanded && (
                    <div className="ml-8 space-y-2 border-l-2 border-muted pl-4">
                      {comment.replies!.map((reply: any) => (
                        <div key={reply.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium">{reply.user?.commercial_name || 'Utilizador'}</p>
                            <span className="text-[10px] text-muted-foreground">{formatDateTime(reply.created_at)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-muted-foreground">
                {total} comentário{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
