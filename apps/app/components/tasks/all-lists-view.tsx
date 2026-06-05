'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Hash, Inbox, MoreHorizontal, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskListItem } from '@/components/tasks/task-list-item'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { TASK_LIST_COLORS, type TaskListColor, type TaskListWithMeta } from '@/types/task-list'
import type { TaskWithRelations } from '@/types/task'

interface AllListsViewProps {
  lists: TaskListWithMeta[]
  tasks: TaskWithRelations[]
  isLoading: boolean
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onSelectTask: (task: TaskWithRelations) => void
  onCreateForList: (listId: string | null) => void
  onRefresh: () => void
  isSelected: (task: TaskWithRelations) => boolean
}

export function AllListsView({
  lists,
  tasks,
  isLoading,
  onToggleComplete,
  onSelectTask,
  onCreateForList,
  onRefresh,
  isSelected,
}: AllListsViewProps) {
  // Group tasks by task_list_id; null = Inbox (no list).
  const tasksByList = useMemo(() => {
    const map = new Map<string | 'none', TaskWithRelations[]>()
    for (const t of tasks) {
      const key = (t.task_list_id ?? 'none') as string | 'none'
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return map
  }, [tasks])

  const inboxTasks = tasksByList.get('none') ?? []

  if (isLoading && lists.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (lists.length === 0 && inboxTasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Sem listas e sem tarefas pendentes.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {lists.map((list) => (
        <ListSection
          key={list.id}
          list={list}
          tasks={tasksByList.get(list.id) ?? []}
          onToggleComplete={onToggleComplete}
          onSelectTask={onSelectTask}
          onAddTask={() => onCreateForList(list.id)}
          onRefresh={onRefresh}
          isSelected={isSelected}
        />
      ))}

      {inboxTasks.length > 0 && (
        <InboxSection
          tasks={inboxTasks}
          onToggleComplete={onToggleComplete}
          onSelectTask={onSelectTask}
          onAddTask={() => onCreateForList(null)}
          onRefresh={onRefresh}
          isSelected={isSelected}
        />
      )}
    </div>
  )
}

function ListSection({
  list,
  tasks,
  onToggleComplete,
  onSelectTask,
  onAddTask,
  onRefresh,
  isSelected,
}: {
  list: TaskListWithMeta
  tasks: TaskWithRelations[]
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onSelectTask: (task: TaskWithRelations) => void
  onAddTask: () => void
  onRefresh: () => void
  isSelected: (task: TaskWithRelations) => boolean
}) {
  const [open, setOpen] = useState(true)
  const colorClass =
    TASK_LIST_COLORS[list.color as TaskListColor]?.hash || 'text-muted-foreground'

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-background/60 transition-colors group"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform shrink-0',
                !open && '-rotate-90',
              )}
            />
            <Hash
              className={cn('h-4 w-4 shrink-0', colorClass)}
              strokeWidth={2.5}
            />
            <span className="text-sm font-semibold tracking-tight truncate flex-1">
              {list.name}
            </span>
            {tasks.length > 0 && (
              <span className="text-[11px] tabular-nums text-muted-foreground/70 shrink-0">
                {tasks.length}
              </span>
            )}
            <span
              className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground/60"
              aria-hidden
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/40">
            {tasks.length > 0 ? (
              <div className="divide-y divide-border/30">
                {tasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    onToggleComplete={onToggleComplete}
                    onSelect={onSelectTask}
                    onRefresh={onRefresh}
                    isSelected={isSelected(task)}
                  />
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onAddTask}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors group"
            >
              <span className="size-[18px] rounded-full border border-muted-foreground/30 group-hover:border-primary group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
                <Plus
                  className="h-3 w-3 group-hover:text-primary"
                  strokeWidth={2.5}
                />
              </span>
              <span>Adicionar tarefa</span>
            </button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function InboxSection({
  tasks,
  onToggleComplete,
  onSelectTask,
  onAddTask,
  onRefresh,
  isSelected,
}: {
  tasks: TaskWithRelations[]
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onSelectTask: (task: TaskWithRelations) => void
  onAddTask: () => void
  onRefresh: () => void
  isSelected: (task: TaskWithRelations) => boolean
}) {
  const [open, setOpen] = useState(true)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-background/60 transition-colors"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform shrink-0',
                !open && '-rotate-90',
              )}
            />
            <Inbox className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold tracking-tight truncate flex-1">
              Sem lista
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground/70 shrink-0">
              {tasks.length}
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/40">
            <div className="divide-y divide-border/30">
              {tasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleComplete}
                  onSelect={onSelectTask}
                  onRefresh={onRefresh}
                  isSelected={isSelected(task)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onAddTask}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors group"
            >
              <span className="size-[18px] rounded-full border border-muted-foreground/30 group-hover:border-primary group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
                <Plus
                  className="h-3 w-3 group-hover:text-primary"
                  strokeWidth={2.5}
                />
              </span>
              <span>Adicionar tarefa</span>
            </button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
