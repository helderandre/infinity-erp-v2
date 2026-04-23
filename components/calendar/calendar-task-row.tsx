'use client'

import { parseISO } from 'date-fns'
import type { TaskWithRelations } from '@/types/task'
import {
  PriorityCheck,
  DueDateText,
} from '@/components/tasks/task-primitives'
import { cn } from '@/lib/utils'

interface CalendarTaskRowProps {
  task: TaskWithRelations
  onSelect: (task: TaskWithRelations) => void
  onToggleComplete: (id: string, isCompleted: boolean) => void
}

/**
 * Compact to-do style row used in the calendar's tasks channel. Visually
 * matches the /dashboard/tarefas list item: coloured priority checkbox on
 * the left, title middle, due chip below. Clicking the row opens the task
 * detail sheet; clicking the checkbox toggles completion in place.
 */
export function CalendarTaskRow({
  task,
  onSelect,
  onToggleComplete,
}: CalendarTaskRowProps) {
  const dueDate = task.due_date ? parseISO(task.due_date) : null
  const isReadOnly =
    task.source === 'proc_task' ||
    task.source === 'proc_subtask' ||
    task.source === 'visit_proposal'

  return (
    <div
      className={cn(
        'group flex items-start gap-2.5 rounded-xl px-2.5 py-2 cursor-pointer transition-colors',
        'hover:bg-muted/50',
        task.is_completed && 'opacity-60',
      )}
      onClick={() => onSelect(task)}
    >
      <div className="mt-[2px]">
        <PriorityCheck
          priority={task.priority}
          checked={task.is_completed}
          disabled={isReadOnly}
          onClick={() =>
            !isReadOnly && onToggleComplete(task.id, task.is_completed)
          }
          title={
            isReadOnly
              ? 'Gerida noutro módulo'
              : task.is_completed
              ? 'Reabrir'
              : 'Concluir'
          }
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-[13px] leading-snug truncate',
            task.is_completed
              ? 'text-muted-foreground line-through decoration-muted-foreground/60'
              : 'text-foreground',
          )}
        >
          {task.title}
        </p>
        {dueDate && (
          <DueDateText
            date={dueDate}
            isCompleted={task.is_completed}
            className="text-[11px]"
          />
        )}
      </div>
    </div>
  )
}
