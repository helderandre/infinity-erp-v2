'use client'

import { format, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  CheckCircle2,
  Circle,
  Clock,
  ListTodo,
  Loader2,
  Plus,
  Activity as ActivityIcon,
  CheckSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNegocioTasks, type NegocioTask } from '@/hooks/use-negocio-tasks'
import {
  useNegocioActivities,
  type NegocioActivity,
} from '@/hooks/use-negocio-activities'
import { ActivityStrip } from '@/components/negocios/dashboard/activity-strip'

interface InicioExtrasProps {
  negocioId: string
  leadId: string | null | undefined
  onCreateTask?: () => void
}

/**
 * Plug-in para o fim da tab "Início" da NegocioDetailSheet.
 * Renderiza:
 *  - "Por fazer" (tarefas pendentes deste negócio com toggle inline)
 *  - "Actividade recente" (leads_activities + tarefas concluídas recentes)
 */
export function InicioExtras({ negocioId, leadId, onCreateTask }: InicioExtrasProps) {
  const tasks = useNegocioTasks(negocioId)
  const acts = useNegocioActivities(leadId, negocioId)

  // Merge completed tasks into activity feed
  const merged: NegocioActivity[] = mergeActivitiesAndCompletedTasks(
    acts.activities,
    tasks.completedRecent,
    negocioId,
  )

  return (
    <>
      <PorFazerPanel
        pending={tasks.pending}
        isLoading={tasks.isLoading}
        onToggle={tasks.toggle}
        onCreateTask={onCreateTask}
      />
      <ActivityStrip
        activities={merged}
        isLoading={acts.isLoading || tasks.isLoading}
      />
    </>
  )
}

// ─── Por fazer ──────────────────────────────────────────────────────────

function PorFazerPanel({
  pending,
  isLoading,
  onToggle,
  onCreateTask,
}: {
  pending: NegocioTask[]
  isLoading: boolean
  onToggle: (taskId: string, nextCompleted: boolean) => Promise<void>
  onCreateTask?: () => void
}) {
  return (
    <section className="rounded-2xl bg-background border border-border/50 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-tight">Por fazer</h3>
          {pending.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {pending.length}
            </span>
          )}
        </div>
        {onCreateTask && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-full text-xs"
            onClick={onCreateTask}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nova tarefa
          </Button>
        )}
      </div>

      {isLoading && pending.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-9 rounded-xl" />
          <Skeleton className="h-9 rounded-xl" />
        </div>
      ) : pending.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3 text-center">
          Sem tarefas pendentes para este negócio.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {pending.slice(0, 6).map((t) => (
            <TaskRow key={t.id} task={t} onToggle={onToggle} />
          ))}
          {pending.length > 6 && (
            <li className="text-xs text-muted-foreground pt-1">
              + {pending.length - 6} {pending.length - 6 === 1 ? 'outra' : 'outras'} pendente{pending.length - 6 === 1 ? '' : 's'}
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

function TaskRow({
  task,
  onToggle,
}: {
  task: NegocioTask
  onToggle: (taskId: string, next: boolean) => Promise<void>
}) {
  const isOverdue =
    task.due_date &&
    !task.is_completed &&
    new Date(task.due_date).getTime() < Date.now()

  const priorityIndicator =
    task.priority === 1
      ? 'bg-red-500'
      : task.priority === 2
        ? 'bg-orange-500'
        : task.priority === 3
          ? 'bg-amber-500'
          : null

  return (
    <li className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-muted/40 transition-colors">
      <button
        type="button"
        onClick={() => onToggle(task.id, !task.is_completed)}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={task.is_completed ? 'Marcar pendente' : 'Marcar concluída'}
      >
        {task.is_completed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      {priorityIndicator && (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', priorityIndicator)} />
      )}

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm leading-tight truncate',
            task.is_completed && 'line-through text-muted-foreground',
          )}
        >
          {task.title}
        </p>
        {task.due_date && (
          <p
            className={cn(
              'text-[11px] mt-0.5 inline-flex items-center gap-1',
              isOverdue ? 'text-red-600' : 'text-muted-foreground',
            )}
          >
            <Clock className="h-3 w-3" />
            {format(new Date(task.due_date), "d 'de' MMM", { locale: pt })}
            {isOverdue && ' · em atraso'}
          </p>
        )}
      </div>

      {task.assignee?.commercial_name && (
        <span className="text-[11px] text-muted-foreground/80 shrink-0 hidden sm:inline">
          {task.assignee.commercial_name.split(' ')[0]}
        </span>
      )}
    </li>
  )
}

// ─── Merge tasks done → activity feed ──────────────────────────────────

function mergeActivitiesAndCompletedTasks(
  activities: NegocioActivity[],
  completedTasks: NegocioTask[],
  negocioId: string,
): NegocioActivity[] {
  const taskAsActivity: NegocioActivity[] = completedTasks
    .filter((t) => !!t.completed_at)
    .map((t) => ({
      id: `task-${t.id}`,
      contact_id: '',
      negocio_id: negocioId,
      activity_type: 'task',
      direction: null,
      subject: `Tarefa concluída: ${t.title}`,
      description: t.description,
      metadata: { task_id: t.id, priority: t.priority },
      created_by: t.completed_by,
      created_at: t.completed_at!,
      created_by_user: t.assignee
        ? { id: t.assignee.id, commercial_name: t.assignee.commercial_name }
        : null,
    }))

  return [...activities, ...taskAsActivity].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}
