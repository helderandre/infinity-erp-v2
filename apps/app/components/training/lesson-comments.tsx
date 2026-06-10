'use client'

import { useCallback, useEffect, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CheckCircle2, Loader2, MessageSquare, Reply, Send } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { TrainingComment } from '@/types/training'

interface LessonCommentsProps {
  lessonId: string
  courseId: string
  /** Controlled state do sheet de composição (mobile). Quando fornecido, o
      composer inline fica escondido em mobile e a escrita passa pelo sheet. */
  composeSheetOpen?: boolean
  onComposeSheetOpenChange?: (open: boolean) => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function CommentItem({
  comment,
  onReplySubmit,
  depth = 0,
}: {
  comment: TrainingComment
  onReplySubmit: (parentId: string, content: string) => Promise<void>
  depth?: number
}) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmitReply() {
    if (!replyContent.trim()) return
    setIsSubmitting(true)
    try {
      await onReplySubmit(comment.id, replyContent.trim())
      setReplyContent('')
      setShowReplyForm(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={depth > 0 ? 'ml-8 border-l-2 border-muted pl-4' : ''}>
      <div className="flex gap-3 py-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">
            {comment.user?.commercial_name ? getInitials(comment.user.commercial_name) : '??'}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {comment.user?.commercial_name ?? 'Utilizador'}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), {
                locale: pt,
                addSuffix: true,
              })}
            </span>
            {comment.is_resolved && (
              <Badge variant="outline" className="gap-1 text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Resolvido
              </Badge>
            )}
          </div>

          <p className="mt-1 text-sm leading-relaxed text-foreground/90">{comment.content}</p>

          {depth < 2 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-auto px-0 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowReplyForm(!showReplyForm)}
            >
              <Reply className="mr-1 h-3 w-3" />
              Responder
            </Button>
          )}

          {showReplyForm && (
            <div className="mt-2 space-y-2">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Escreva a sua resposta..."
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSubmitReply}
                  disabled={isSubmitting || !replyContent.trim()}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-3 w-3" />
                  )}
                  Enviar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowReplyForm(false)
                    setReplyContent('')
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          onReplySubmit={onReplySubmit}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

export function LessonComments({ lessonId, courseId, composeSheetOpen, onComposeSheetOpenChange }: LessonCommentsProps) {
  const hasComposeSheet = onComposeSheetOpenChange != null
  const [comments, setComments] = useState<TrainingComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/training/courses/${courseId}/lessons/${lessonId}/comments`
      )
      if (!res.ok) throw new Error('Erro ao carregar comentários')
      const json = await res.json()
      setComments(json.data || json || [])
    } catch {
      toast.error('Erro ao carregar comentários')
    } finally {
      setIsLoading(false)
    }
  }, [courseId, lessonId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  async function handleSubmitComment() {
    if (!newComment.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch(
        `/api/training/courses/${courseId}/lessons/${lessonId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newComment.trim() }),
        }
      )
      if (!res.ok) throw new Error('Erro ao publicar comentário')
      setNewComment('')
      toast.success('Comentário publicado')
      onComposeSheetOpenChange?.(false)
      await fetchComments()
    } catch {
      toast.error('Erro ao publicar comentário')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReplySubmit(parentId: string, content: string) {
    try {
      const res = await fetch(
        `/api/training/courses/${courseId}/lessons/${lessonId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, parent_id: parentId }),
        }
      )
      if (!res.ok) throw new Error('Erro ao publicar resposta')
      toast.success('Resposta publicada')
      fetchComments()
    } catch {
      toast.error('Erro ao publicar resposta')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-5 w-5" />
          Comentários
          {!isLoading && (
            <Badge variant="secondary" className="ml-1">
              {comments.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment List */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">
              Ainda não existem comentários. Seja o primeiro a comentar!
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReplySubmit={handleReplySubmit}
              />
            ))}
          </div>
        )}

        {/* New Comment Form — inline só em desktop quando existe sheet de composição */}
        <div className={cn('space-y-2 border-t pt-4', hasComposeSheet && 'max-sm:hidden')}>
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escreva um comentário..."
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmitComment}
              disabled={isSubmitting || !newComment.trim()}
              size="sm"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Publicar comentário
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Sheet de composição (mobile) — glassmórfico, fecha ao publicar */}
      {hasComposeSheet && (
        <Sheet open={composeSheetOpen} onOpenChange={onComposeSheetOpenChange}>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl border-border/40 bg-background/85 px-4 pb-6 backdrop-blur-2xl"
          >
            <SheetHeader className="px-0">
              <SheetTitle>Comentar</SheetTitle>
            </SheetHeader>
            <div className="space-y-3">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escreva um comentário..."
                rows={4}
                autoFocus
              />
              <Button
                className="w-full rounded-full"
                onClick={handleSubmitComment}
                disabled={isSubmitting || !newComment.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Publicar comentário
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Card>
  )
}
