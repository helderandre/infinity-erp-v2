'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { ProcessTaskCard } from './process-task-card'
import { cn } from '@/lib/utils'
import type { ProcessStageWithTasks, ProcessTask } from '@/types/process'

const STAGE_COLORS = [
  'bg-indigo-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-pink-500',
]

interface ProcessListViewProps {
  stages: ProcessStageWithTasks[]
  isProcessing: boolean
  onTaskAction: (taskId: string, action: string) => void
  onTaskBypass: (task: ProcessTask) => void
  onTaskAssign: (task: ProcessTask) => void
  onTaskClick?: (task: ProcessTask) => void
}

export function ProcessListView({
  stages,
  isProcessing,
  onTaskAction,
  onTaskBypass,
  onTaskAssign,
  onTaskClick,
}: ProcessListViewProps) {
  const [openStages, setOpenStages] = useState<Set<string>>(() =>
    new Set(stages.filter((s) => s.status !== 'completed').map((s) => s.name))
  )

  const toggleStage = (name: string) => {
    setOpenStages((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => {
        const dotColor = STAGE_COLORS[idx % STAGE_COLORS.length]
        const progress = stage.tasks_total > 0
          ? Math.round((stage.tasks_completed / stage.tasks_total) * 100)
          : 0
        const isOpen = openStages.has(stage.name)

        return (
          <Collapsible
            key={stage.name}
            open={isOpen}
            onOpenChange={() => toggleStage(stage.name)}
          >
            <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors">
              <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', dotColor)} />
              <span className="text-sm font-semibold flex-1 text-left">{stage.name}</span>
              <Badge variant="secondary" className="text-xs tabular-nums">
                {stage.tasks_completed}/{stage.tasks_total}
              </Badge>
              <Progress value={progress} className="h-1.5 w-16" />
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="mt-2 ml-5 space-y-2">
                {stage.tasks.map((task: ProcessTask) => (
                  <ProcessTaskCard
                    key={task.id}
                    task={task}
                    variant="list"
                    isProcessing={isProcessing}
                    onAction={onTaskAction}
                    onBypass={onTaskBypass}
                    onAssign={onTaskAssign}
                    onClick={onTaskClick}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}
