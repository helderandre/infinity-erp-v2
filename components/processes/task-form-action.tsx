'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ClipboardList,
  CheckCircle2,
  Circle,
  ChevronDown,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProcessTask } from '@/types/process'
import type { ProcSubtask } from '@/types/subtask'

interface TaskFormActionProps {
  task: ProcessTask & { subtasks: ProcSubtask[] }
  processId: string
  onSubtaskToggle: (taskId: string, subtaskId: string, completed: boolean) => Promise<void>
  onTaskUpdate: () => void
}

export function TaskFormAction({
  task,
  processId,
  onSubtaskToggle,
  onTaskUpdate,
}: TaskFormActionProps) {
  const [open, setOpen] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const subtasks = task.subtasks || []
  const completedCount = subtasks.filter((s) => s.is_completed).length
  const totalCount = subtasks.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleToggle = async (subtask: ProcSubtask) => {
    const config = subtask.config || ({} as any)
    if (config.check_type !== 'manual') return

    setToggling(subtask.id)
    try {
      await onSubtaskToggle(task.id, subtask.id, !subtask.is_completed)
      onTaskUpdate()
    } catch {
      // Error handled by parent
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="rounded-lg border bg-card/50 p-3 space-y-3">
      {/* Header */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
          <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="flex-1 text-xs font-medium text-muted-foreground">
            {completedCount} de {totalCount} items completos
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>

        {/* Progress bar */}
        <Progress value={progress} className="h-1.5 mt-2" />

        <CollapsibleContent>
          <div className="mt-3 space-y-1.5">
            {subtasks.map((subtask) => {
              const config = (subtask.config || {}) as {
                check_type: string
                field_name?: string
                doc_type_id?: string
              }
              const isManual = config.check_type === 'manual'
              const isLoading = toggling === subtask.id

              return (
                <div
                  key={subtask.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                    subtask.is_completed && 'opacity-60'
                  )}
                >
                  {/* Checkbox or status icon */}
                  {isManual ? (
                    <div className="shrink-0">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Checkbox
                          checked={subtask.is_completed}
                          onCheckedChange={() => handleToggle(subtask)}
                          className="h-4 w-4"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="shrink-0">
                      {subtask.is_completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  )}

                  {/* Title */}
                  <span
                    className={cn(
                      'flex-1 text-xs',
                      subtask.is_completed && 'line-through text-muted-foreground'
                    )}
                  >
                    {subtask.title}
                  </span>

                  {/* Badges */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isManual && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        Auto
                      </Badge>
                    )}
                    {!subtask.is_mandatory && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        Opcional
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Link to owner */}
          {task.owner?.id && (
            <div className="mt-3 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                asChild
              >
                <a
                  href={`/dashboard/proprietarios/${task.owner.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-1.5 h-3 w-3" />
                  Abrir ficha do proprietário
                </a>
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
