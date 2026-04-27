'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronDown, Hash, Inbox, LayoutList, ListChecks, Plus, Users, Workflow } from 'lucide-react'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useTaskLists } from '@/hooks/use-task-lists'
import { NewListDialog } from '@/components/tasks/new-list-dialog'
import { TASK_LIST_COLORS, type TaskListColor, type TaskListWithMeta } from '@/types/task-list'

interface TaskListSwitcherProps {
  /** Current context: undefined when on Tarefas/Processos view, list id when in a list */
  activeListId: string | null
  /** Name of the current list if known (to render in trigger without waiting for fetch) */
  activeListName?: string
  activeListColor?: TaskListColor
  /** Current non-list view label (shown in trigger when no list is active) */
  defaultViewLabel?: string
  /** 'pill' (default, compact) for use next to tab pills, 'title' for use as page title */
  variant?: 'pill' | 'title'
}

export function TaskListSwitcher({
  activeListId,
  activeListName,
  activeListColor = 'neutral',
  defaultViewLabel = 'Tarefas',
  variant = 'pill',
}: TaskListSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const { owned, shared, isLoading, refetch } = useTaskLists()

  const navigate = (listId: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (listId) params.set('list', listId)
    else params.delete('list')
    params.delete('view')
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`)
    setOpen(false)
  }

  const navigateAllLists = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'all-lists')
    params.delete('list')
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  const viewParam = searchParams.get('view')
  const isAllListsView = viewParam === 'all-lists'

  const onListCreated = (newId?: string) => {
    refetch()
    if (newId) navigate(newId)
  }

  const triggerLabel = isAllListsView
    ? 'Todas as listas'
    : activeListId
      ? (activeListName || 'Lista')
      : defaultViewLabel
  const triggerColor = TASK_LIST_COLORS[activeListColor]?.hash || 'text-muted-foreground'

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center transition-colors',
              variant === 'title'
                ? 'gap-2 px-1.5 py-0.5 -ml-1.5 rounded-md text-xl font-semibold tracking-tight text-foreground hover:bg-muted/60'
                : 'gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full text-sm font-medium bg-muted/40 hover:bg-muted/60 text-foreground',
            )}
          >
            {activeListId ? (
              <Hash
                className={cn(
                  variant === 'title' ? 'h-5 w-5' : 'h-4 w-4',
                  triggerColor,
                )}
                strokeWidth={2.5}
              />
            ) : (
              <ListChecks
                className={cn(
                  variant === 'title' ? 'h-5 w-5' : 'h-4 w-4',
                  'text-muted-foreground',
                )}
              />
            )}
            <span className={cn(variant === 'title' ? 'max-w-[280px]' : 'max-w-[140px]', 'truncate')}>
              {triggerLabel}
            </span>
            <ChevronDown
              className={cn(
                variant === 'title' ? 'h-4 w-4' : 'h-3.5 w-3.5',
                'text-muted-foreground/70',
              )}
              strokeWidth={2.5}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-64 p-1.5">
          {/* Default views */}
          <button
            type="button"
            onClick={() => navigate(null)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors',
              !activeListId && !isAllListsView
                ? 'bg-muted/60 text-foreground'
                : 'hover:bg-muted/40',
            )}
          >
            <Inbox className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-left">Entrada</span>
          </button>

          <button
            type="button"
            onClick={navigateAllLists}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors',
              isAllListsView
                ? 'bg-muted/60 text-foreground'
                : 'hover:bg-muted/40',
            )}
          >
            <LayoutList className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-left">Ver todas as listas</span>
          </button>

          {/* Lists */}
          {(owned.length > 0 || shared.length > 0) && (
            <div className="h-px bg-border/60 my-1.5 mx-1" />
          )}

          {owned.length > 0 && (
            <>
              <p className="px-2 pt-1 pb-0.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                Minhas listas
              </p>
              {owned.map((l) => (
                <ListOption
                  key={l.id}
                  list={l}
                  active={activeListId === l.id}
                  onClick={() => navigate(l.id)}
                />
              ))}
            </>
          )}

          {shared.length > 0 && (
            <>
              <p className="px-2 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 flex items-center gap-1">
                <Users className="h-2.5 w-2.5" />
                Partilhadas
              </p>
              {shared.map((l) => (
                <ListOption
                  key={l.id}
                  list={l}
                  active={activeListId === l.id}
                  onClick={() => navigate(l.id)}
                />
              ))}
            </>
          )}

          {!isLoading && owned.length === 0 && shared.length === 0 && (
            <p className="px-2 py-2 text-[11.5px] text-muted-foreground/60 italic">
              Sem listas ainda.
            </p>
          )}

          <div className="h-px bg-border/60 my-1.5 mx-1" />

          <button
            type="button"
            onClick={() => { setOpen(false); setNewDialogOpen(true) }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            Nova lista
          </button>
        </PopoverContent>
      </Popover>

      <NewListDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onCreated={onListCreated}
      />
    </>
  )
}

function ListOption({
  list,
  active,
  onClick,
}: {
  list: TaskListWithMeta
  active: boolean
  onClick: () => void
}) {
  const colorClass = TASK_LIST_COLORS[list.color as TaskListColor]?.hash || 'text-muted-foreground'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors',
        active ? 'bg-muted/60 text-foreground' : 'hover:bg-muted/40',
      )}
    >
      <Hash className={cn('h-3.5 w-3.5 shrink-0', active ? '' : colorClass)} strokeWidth={2.5} />
      <span className="flex-1 text-left truncate">{list.name}</span>
      {!list.is_owner && (
        <Users className="h-3 w-3 text-muted-foreground/60 shrink-0" />
      )}
      {list.pending_count > 0 && (
        <span className="text-[10px] tabular-nums text-muted-foreground/70 shrink-0">
          {list.pending_count}
        </span>
      )}
    </button>
  )
}
