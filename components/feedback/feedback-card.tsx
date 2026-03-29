'use client'

import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Bug, Lightbulb, User, GripVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { TASK_PRIORITY_MAP } from '@/types/task'
import type { FeedbackWithRelations } from '@/types/feedback'

interface FeedbackCardProps {
  item: FeedbackWithRelations
  onClick: (item: FeedbackWithRelations) => void
}

export function FeedbackCard({ item, onClick }: FeedbackCardProps) {
  const priority = TASK_PRIORITY_MAP[item.priority as keyof typeof TASK_PRIORITY_MAP]
  const Icon = item.type === 'ticket' ? Bug : Lightbulb

  return (
    <div
      className="group rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick(item)}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <Icon className={cn(
          'h-4 w-4 shrink-0 mt-0.5',
          item.type === 'ticket' ? 'text-red-500' : 'text-amber-500',
        )} />
        <h4 className="text-sm font-medium leading-tight flex-1 line-clamp-2">
          {item.title}
        </h4>
        <span className={cn('h-2 w-2 rounded-full shrink-0 mt-1.5', priority.dot)} />
      </div>

      {/* Description preview */}
      {item.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {item.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {item.submitter?.commercial_name || 'Anónimo'}
        </div>
        <span>{format(new Date(item.created_at), 'd MMM', { locale: pt })}</span>
      </div>

      {/* Assignee */}
      {item.assignee && (
        <div className="mt-1.5 flex items-center gap-1 text-[0.65rem]">
          <Badge variant="outline" className="text-[0.6rem] h-4 px-1">
            {item.assignee.commercial_name}
          </Badge>
        </div>
      )}
    </div>
  )
}
