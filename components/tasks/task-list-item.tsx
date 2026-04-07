'use client'

import Link from 'next/link'
import { format, isPast, isToday } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  CalendarDays, ChevronRight, MessageSquare, Paperclip, RotateCcw, User, Workflow,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { TASK_PRIORITY_MAP, TASK_ENTITY_LABELS } from '@/types/task'
import type { TaskWithRelations, TaskEntityType } from '@/types/task'

interface TaskListItemProps {
  task: TaskWithRelations
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onSelect: (task: TaskWithRelations) => void
}

export function TaskListItem({ task, onToggleComplete, onSelect }: TaskListItemProps) {
  const priority = TASK_PRIORITY_MAP[task.priority as keyof typeof TASK_PRIORITY_MAP]
  const isOverdue = task.due_date && !task.is_completed && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
  const isDueToday = task.due_date && isToday(new Date(task.due_date))
  const subTaskCount = (task.sub_tasks || []).length
  const subTasksDone = (task.sub_tasks || []).filter((st) => st.is_completed).length
  const commentCount = (task as any).task_comments?.[0]?.count || 0
  const attachmentCount = (task as any).task_attachments?.[0]?.count || 0
  const isProcessTask = task.source === 'proc_task' || task.source === 'proc_subtask'

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50 cursor-pointer',
        task.is_completed && 'opacity-60',
      )}
      onClick={() => onSelect(task)}
    >
      {/* Checkbox — disabled for process-sourced tasks (managed in process page) */}
      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={task.is_completed}
          onCheckedChange={() => !isProcessTask && onToggleComplete(task.id, task.is_completed)}
          disabled={isProcessTask}
          className={cn('mt-0.5', priority.color, isProcessTask && 'cursor-not-allowed opacity-60')}
          title={isProcessTask ? 'Concluir no detalhe do processo' : undefined}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Priority dot */}
          <span className={cn('h-2 w-2 shrink-0 rounded-full', priority.dot)} />

          {/* Title */}
          <span className={cn(
            'text-sm font-medium truncate',
            task.is_completed && 'line-through text-muted-foreground',
          )}>
            {task.title}
          </span>

          {/* Recurring icon */}
          {task.is_recurring && (
            <RotateCcw className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {/* Due date */}
          {task.due_date && (
            <span className={cn(
              'flex items-center gap-1',
              isOverdue && 'text-red-600 font-medium',
              isDueToday && 'text-orange-600 font-medium',
            )}>
              <CalendarDays className="h-3 w-3" />
              {format(new Date(task.due_date), 'd MMM', { locale: pt })}
            </span>
          )}

          {/* Assignee */}
          {task.assignee && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assignee.commercial_name}
            </span>
          )}

          {/* Entity link — clickable when we have a target */}
          {isProcessTask && task.process_id ? (
            <Link
              href={`/dashboard/processos/${task.process_id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex"
            >
              <Badge
                variant="outline"
                className="text-[0.65rem] h-4 px-1.5 gap-1 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition-colors"
              >
                <Workflow className="h-2.5 w-2.5" />
                {task.process_ref || 'Processo'}
                {task.stage_name && <span className="opacity-70">· {task.stage_name}</span>}
              </Badge>
            </Link>
          ) : task.entity_type ? (
            <Badge variant="outline" className="text-[0.65rem] h-4 px-1.5">
              {TASK_ENTITY_LABELS[task.entity_type as TaskEntityType]}
            </Badge>
          ) : null}

          {/* Sub-tasks */}
          {subTaskCount > 0 && (
            <span className="flex items-center gap-1">
              {subTasksDone}/{subTaskCount}
            </span>
          )}

          {/* Comments */}
          {commentCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {commentCount}
            </span>
          )}

          {/* Attachments */}
          {attachmentCount > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {attachmentCount}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
    </div>
  )
}
