'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  Ban,
} from 'lucide-react'
import { ACTION_TYPE_LABELS } from '@/lib/constants'
import { useTaskComments } from '@/hooks/use-task-comments'
import { TaskDetailMetadata } from './task-detail-metadata'
import { TaskDetailActions } from './task-detail-actions'
import { TaskActivityFeed } from './task-activity-feed'
import { CommentInput } from './comment-input'
import { toast } from 'sonner'
import type { ProcessTask, ProcessDocument, ProcessOwner, TaskCommentMention } from '@/types/process'

const STATUS_ICONS = {
  completed: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  in_progress: <PlayCircle className="h-5 w-5 text-blue-500" />,
  skipped: <Ban className="h-5 w-5 text-orange-500" />,
  pending: <Circle className="h-5 w-5 text-muted-foreground" />,
}

interface TaskDetailSheetProps {
  task: ProcessTask | null
  processId: string
  propertyId: string
  processDocuments?: ProcessDocument[]
  owners?: ProcessOwner[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskUpdate: () => void
}

export function TaskDetailSheet({
  task,
  processId,
  propertyId,
  processDocuments,
  owners,
  open,
  onOpenChange,
  onTaskUpdate,
}: TaskDetailSheetProps) {
  const [commentValue, setCommentValue] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [mentionUsers, setMentionUsers] = useState<{ id: string; display: string }[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const { comments, isLoading: isCommentsLoading, addComment } = useTaskComments(
    processId,
    task?.id ?? null
  )

  // Fetch users for mentions
  useEffect(() => {
    if (!open) return

    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users/consultants')
        if (!res.ok) throw new Error()
        const data: { id: string; commercial_name: string }[] = await res.json()
        setMentionUsers(data.map((u) => ({ id: u.id, display: u.commercial_name })))
      } catch {
        // silent
      }
    }
    loadUsers()
  }, [open])

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current && comments.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments.length])

  const handleSubmitComment = useCallback(async () => {
    if (!commentValue.trim() || isSubmittingComment) return

    setIsSubmittingComment(true)
    try {
      // Parse mentions from the comment value
      const mentions: TaskCommentMention[] = []
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
      let match
      while ((match = mentionRegex.exec(commentValue)) !== null) {
        mentions.push({ display_name: match[1], user_id: match[2] })
      }

      await addComment(commentValue, mentions)
      setCommentValue('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar comentário')
    } finally {
      setIsSubmittingComment(false)
    }
  }, [commentValue, isSubmittingComment, addComment])

  if (!task) return null

  const statusIcon = STATUS_ICONS[task.status as keyof typeof STATUS_ICONS] ?? STATUS_ICONS.pending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full min-w-[600px] p-0 flex flex-col h-full">
        {/* HEADER FIXO */}
        <SheetHeader className="border-b px-6 py-4 space-y-2">
          <div className="flex items-center gap-2">
            {statusIcon}
            <SheetTitle className="text-lg">{task.title}</SheetTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {ACTION_TYPE_LABELS[task.action_type as keyof typeof ACTION_TYPE_LABELS] ?? task.action_type}
            </Badge>
            {task.is_mandatory && (
              <Badge variant="outline" className="text-xs">
                Obrigatória
              </Badge>
            )}
            {task.stage_name && (
              <Badge variant="outline" className="text-xs">
                {task.stage_name}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* CORPO SCROLLÁVEL */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Metadados editáveis */}
          <TaskDetailMetadata
            task={task}
            processId={processId}
            onTaskUpdate={onTaskUpdate}
          />

          <Separator />

          {/* Acções por tipo */}
          <TaskDetailActions
            task={task}
            processId={processId}
            propertyId={propertyId}
            processDocuments={processDocuments}
            owners={owners}
            onTaskUpdate={onTaskUpdate}
          />

          <Separator />

          {/* Feed de comentários */}
          <TaskActivityFeed
            comments={comments}
            isLoading={isCommentsLoading}
          />
        </div>

        {/* FOOTER FIXO — Input de comentário */}
        <div className="border-t px-6 py-3">
          <CommentInput
            value={commentValue}
            onChange={setCommentValue}
            users={mentionUsers}
            onSubmit={handleSubmitComment}
            isSubmitting={isSubmittingComment}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
