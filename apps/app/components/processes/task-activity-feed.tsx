'use client'

import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { TaskComment } from '@/types/process'

interface TaskActivityFeedProps {
  comments: TaskComment[]
  isLoading: boolean
}

function renderCommentContent(content: string): React.ReactNode {
  const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/)
  return parts.map((part, i) => {
    const match = part.match(/@\[([^\]]+)\]\(([^)]+)\)/)
    if (match) {
      return (
        <span key={i} className="text-primary font-medium bg-primary/10 rounded px-1">
          @{match[1]}
        </span>
      )
    }
    return part
  })
}

export function TaskActivityFeed({ comments, isLoading }: TaskActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comentários
        </h4>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Comentários ({comments.length})
      </h4>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Sem comentários. Seja o primeiro a comentar.
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar>
                {comment.user?.profile?.profile_photo_url && (
                  <AvatarImage
                    src={comment.user.profile.profile_photo_url}
                    alt={comment.user.commercial_name || ''}
                  />
                )}
                <AvatarFallback>
                  {comment.user?.commercial_name?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {comment.user?.commercial_name || 'Utilizador'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                      locale: pt,
                    })}
                  </span>
                </div>
                <p className="text-sm mt-0.5 whitespace-pre-wrap">
                  {renderCommentContent(comment.content)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
