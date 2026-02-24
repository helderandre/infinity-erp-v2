'use client'

import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ProcessTaskCard } from './process-task-card'
import { cn } from '@/lib/utils'
import type { ProcessStageWithTasks, ProcessTask } from '@/types/process'

const STAGE_COLORS = [
  { dot: 'bg-indigo-500', headerBg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { dot: 'bg-sky-500', headerBg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  { dot: 'bg-violet-500', headerBg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { dot: 'bg-amber-500', headerBg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { dot: 'bg-emerald-500', headerBg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { dot: 'bg-pink-500', headerBg: 'bg-pink-500/10', border: 'border-pink-500/20' },
]

interface ProcessKanbanViewProps {
  stages: ProcessStageWithTasks[]
  isProcessing: boolean
  onTaskAction: (taskId: string, action: string) => void
  onTaskBypass: (task: ProcessTask) => void
  onTaskAssign: (task: ProcessTask) => void
  onTaskClick?: (task: ProcessTask) => void
}

export function ProcessKanbanView({
  stages,
  isProcessing,
  onTaskAction,
  onTaskBypass,
  onTaskAssign,
  onTaskClick,
}: ProcessKanbanViewProps) {
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4" style={{ minHeight: 'calc(100vh - 260px)' }}>
        {stages.map((stage, idx) => {
          const color = STAGE_COLORS[idx % STAGE_COLORS.length]
          const progress = stage.tasks_total > 0
            ? Math.round((stage.tasks_completed / stage.tasks_total) * 100)
            : 0

          return (
            <div
              key={stage.name}
              className={cn('flex flex-col rounded-xl border bg-muted/30', color.border)}
              style={{ minWidth: 320, maxWidth: 420, width: 380 }}
            >
              {/* Column header */}
              <div className={cn('p-3 rounded-t-xl space-y-2', color.headerBg)}>
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', color.dot)} />
                  <span className="text-sm font-semibold truncate flex-1">{stage.name}</span>
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {stage.tasks_completed}/{stage.tasks_total}
                  </Badge>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>

              {/* Column body */}
              <ScrollArea className="flex-1" style={{ maxHeight: 'calc(100vh - 340px)' }}>
                <div className="p-2 space-y-2">
                  {stage.tasks.map((task: ProcessTask) => (
                    <ProcessTaskCard
                      key={task.id}
                      task={task}
                      variant="kanban"
                      isProcessing={isProcessing}
                      onAction={onTaskAction}
                      onBypass={onTaskBypass}
                      onAssign={onTaskAssign}
                      onClick={onTaskClick}
                    />
                  ))}
                  {stage.tasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      Sem tarefas
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
