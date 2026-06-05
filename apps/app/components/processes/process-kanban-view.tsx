'use client'

import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import { ProcessTaskCard } from './process-task-card'
import { cn } from '@/lib/utils'
import type { ProcessStageWithTasks, ProcessTask } from '@/types/process'

const STAGE_STATUS_COLORS = {
  current: {
    dot: 'bg-blue-500',
    headerBg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-700',
  },
  completed: {
    dot: 'bg-emerald-500',
    headerBg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-700',
  },
  waiting: {
    dot: 'bg-slate-400',
    headerBg: 'bg-slate-400/10',
    border: 'border-slate-400/20',
    text: 'text-slate-500',
  },
} as const

function getStageColor(stage: ProcessStageWithTasks) {
  if (stage.is_completed_explicit) return STAGE_STATUS_COLORS.completed
  if (stage.is_current) return STAGE_STATUS_COLORS.current
  return STAGE_STATUS_COLORS.waiting
}

interface ProcessKanbanViewProps {
  stages: ProcessStageWithTasks[]
  isProcessing: boolean
  canDeleteAdhoc?: boolean
  onTaskAction: (taskId: string, action: string) => void
  onTaskBypass: (task: ProcessTask) => void
  onTaskAssign: (task: ProcessTask) => void
  onTaskClick?: (task: ProcessTask) => void
  onTaskDelete?: (task: ProcessTask) => void
  onStageComplete?: (stageId: string) => void
}

export function ProcessKanbanView({
  stages,
  isProcessing,
  canDeleteAdhoc,
  onTaskAction,
  onTaskBypass,
  onTaskAssign,
  onTaskClick,
  onTaskDelete,
  onStageComplete,
}: ProcessKanbanViewProps) {
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4" style={{ minHeight: 'calc(100vh - 260px)' }}>
        {stages.map((stage) => {
          const color = getStageColor(stage)
          const progress = stage.tasks_total > 0
            ? Math.round((stage.tasks_completed / stage.tasks_total) * 100)
            : 0

          return (
            <div
              key={stage.id}
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
                {stage.is_current && !stage.is_completed_explicit && onStageComplete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-1 text-xs"
                    onClick={() => onStageComplete(stage.id)}
                    disabled={isProcessing}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Concluir Estágio
                  </Button>
                )}
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
                      canDeleteAdhoc={canDeleteAdhoc}
                      onAction={onTaskAction}
                      onBypass={onTaskBypass}
                      onAssign={onTaskAssign}
                      onClick={onTaskClick}
                      onDelete={onTaskDelete}
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
