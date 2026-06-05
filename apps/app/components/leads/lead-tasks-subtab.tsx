'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ListTodo, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TaskListItem } from '@/components/tasks/task-list-item'
import { TaskDetailSheet } from '@/components/tasks/task-detail-sheet'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { TaskWithRelations } from '@/types/task'

interface LeadTasksSubtabProps {
  contactId: string
  /** IDs of negocios belonging to this contact — tasks linked to them are
   *  also surfaced. Pass an empty array if not loaded yet. */
  negocioIds: string[]
  /** Opens the parent's <TaskForm> with this lead pre-linked */
  onCreateTask: () => void
}

interface TasksResp {
  data?: TaskWithRelations[]
}

/**
 * Lists tasks linked to this contact: tasks with
 *   `entity_type='lead'  AND entity_id=contactId`   (direct contact tasks)
 *   OR
 *   `entity_type='negocio' AND entity_id IN negocioIds` (tasks on the
 *   contact's opportunities)
 *
 * Sections: Pendentes (open) on top, Concluídas collapsed at the bottom.
 * Reuses `<TaskListItem>` for visual consistency with /dashboard/tarefas.
 */
export function LeadTasksSubtab({ contactId, negocioIds, onCreateTask }: LeadTasksSubtabProps) {
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch lead-scoped + each negocio-scoped tasks in parallel.
      const requests: Promise<TasksResp>[] = [
        fetch(`/api/tasks?entity_type=lead&entity_id=${contactId}&limit=200`)
          .then((r) => (r.ok ? r.json() : { data: [] })),
        ...negocioIds.map((nid) =>
          fetch(`/api/tasks?entity_type=negocio&entity_id=${nid}&limit=200`)
            .then((r) => (r.ok ? r.json() : { data: [] })),
        ),
      ]
      const results = await Promise.all(requests)
      const merged: TaskWithRelations[] = []
      const seen = new Set<string>()
      for (const r of results) {
        for (const t of r?.data ?? []) {
          if (!seen.has(t.id)) {
            seen.add(t.id)
            merged.push(t)
          }
        }
      }
      setTasks(merged)
    } catch {
      setTasks([])
    } finally {
      setIsLoading(false)
    }
  }, [contactId, negocioIds])

  useEffect(() => {
    void load()
  }, [load])

  const { pending, completed } = useMemo(() => {
    const open: TaskWithRelations[] = []
    const done: TaskWithRelations[] = []
    for (const t of tasks) {
      if (t.is_completed) done.push(t)
      else open.push(t)
    }
    // Sort pending by due_date asc (no due → bottom). Completed by completed_at desc.
    open.sort((a, b) => {
      const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity
      const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity
      if (ad !== bd) return ad - bd
      return (a.priority ?? 4) - (b.priority ?? 4)
    })
    done.sort((a, b) => {
      const ad = a.completed_at ? new Date(a.completed_at).getTime() : 0
      const bd = b.completed_at ? new Date(b.completed_at).getTime() : 0
      return bd - ad
    })
    return { pending: open, completed: done }
  }, [tasks])

  async function handleToggleComplete(id: string, current: boolean) {
    // Optimistic flip
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_completed: !current } : t)),
    )
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !current }),
      })
      if (!res.ok) throw new Error()
      void load()
    } catch {
      // Revert
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_completed: current } : t)),
      )
      toast.error('Erro ao actualizar tarefa')
    }
  }

  return (
    <div className="space-y-3">
      {/* Header bar: count + add button */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] text-muted-foreground">
          {isLoading
            ? 'A carregar tarefas…'
            : pending.length > 0
              ? `${pending.length} ${pending.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}`
              : 'Sem tarefas pendentes'}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-full text-xs"
          onClick={onCreateTask}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nova tarefa
        </Button>
      </div>

      <div className="rounded-2xl bg-card/40 ring-1 ring-border/60 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-xs">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            A carregar…
          </div>
        ) : pending.length === 0 && completed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-6">
            <ListTodo className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium">Sem tarefas para este contacto</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cria a próxima acção a fazer com este contacto ou nas suas oportunidades.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 h-8 rounded-full text-xs"
              onClick={onCreateTask}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova tarefa
            </Button>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div>
                {pending.map((t) => (
                  <TaskListItem
                    key={t.id}
                    task={t}
                    onToggleComplete={handleToggleComplete}
                    onSelect={(task) => setSelectedTaskId(task.id)}
                    onRefresh={() => void load()}
                  />
                ))}
              </div>
            )}

            {completed.length > 0 && (
              <div className={cn('border-t border-border/60', pending.length === 0 && 'border-t-0')}>
                <button
                  type="button"
                  onClick={() => setShowCompleted((v) => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {showCompleted ? 'Ocultar' : 'Mostrar'} concluídas ({completed.length})
                </button>
                {showCompleted && (
                  <div className="border-t border-border/40">
                    {completed.map((t) => (
                      <TaskListItem
                        key={t.id}
                        task={t}
                        onToggleComplete={handleToggleComplete}
                        onSelect={(task) => setSelectedTaskId(task.id)}
                        onRefresh={() => void load()}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <TaskDetailSheet
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId(null)
        }}
        onRefresh={() => void load()}
        onCreateSubTask={() => {
          // Sub-task creation is gated to the main /dashboard/tarefas surface;
          // from the lead detail context we just close the sheet.
          setSelectedTaskId(null)
        }}
      />
    </div>
  )
}
