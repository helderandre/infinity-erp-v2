'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Hash, Users, ListChecks, Plus, ChevronRight, Loader2,
} from 'lucide-react'
import {
  SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { useTaskLists } from '@/hooks/use-task-lists'
import { NewListDialog } from '@/components/tasks/new-list-dialog'
import { TASK_LIST_COLORS, type TaskListColor, type TaskListWithMeta } from '@/types/task-list'

export function TaskListsSidebarGroup() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeListId = searchParams.get('list')
  const onTarefasPage = pathname === '/dashboard/tarefas' || pathname?.startsWith('/dashboard/tarefas/')
  const { state, isMobile } = useSidebar()
  const isIconMode = state === 'collapsed' && !isMobile

  const { owned, shared, isLoading, refetch } = useTaskLists()
  const [createOpen, setCreateOpen] = useState(false)

  const isSectionActive = onTarefasPage && !!activeListId

  // Icon-mode: hide the group entirely (lists are secondary nav; don't crowd)
  if (isIconMode) return null

  if (isLoading) {
    return (
      <SidebarGroup className="py-1">
        <SidebarGroupLabel className="flex items-center gap-2 px-2 py-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
          <ListChecks className="size-3.5 opacity-60" />
          Listas
        </SidebarGroupLabel>
        <SidebarGroupContent className="px-3 py-1">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <>
      <SidebarGroup className="py-1">
        <Collapsible defaultOpen={isSectionActive || owned.length + shared.length > 0} className="group/collapsible">
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger className={cn(
              'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-[11px] uppercase tracking-wider font-semibold transition-colors',
              isSectionActive
                ? 'border border-border text-foreground/90 bg-muted/40 shadow-sm'
                : 'text-muted-foreground/70 hover:text-muted-foreground',
            )}>
              <ListChecks className={cn('size-3.5', isSectionActive ? 'opacity-80' : 'opacity-60')} />
              Listas
              <ChevronRight className="ml-auto size-3.5 opacity-40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>

          <CollapsibleContent>
            <SidebarGroupContent className="mt-0.5">
              <SidebarMenu className="gap-0.5 pl-4 pr-1">
                {/* Owned */}
                {owned.map((l) => (
                  <ListRow key={l.id} list={l} activeListId={activeListId} onTarefasPage={onTarefasPage} />
                ))}

                {/* Shared — separator label if any */}
                {shared.length > 0 && (
                  <div className="mt-1.5 mb-0.5 flex items-center gap-1.5 px-2 text-[9.5px] uppercase tracking-wider text-muted-foreground/50">
                    <Users className="h-3 w-3" />
                    Partilhadas
                  </div>
                )}
                {shared.map((l) => (
                  <ListRow key={l.id} list={l} activeListId={activeListId} onTarefasPage={onTarefasPage} />
                ))}

                {/* + Nova lista */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setCreateOpen(true)}
                    className="rounded-xl text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <Plus className="size-3.5" />
                    <span className="text-[13px]">Nova lista</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>

      <NewListDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refetch} />
    </>
  )
}

// ─── Individual list row ─────────────────────────────────────

function ListRow({
  list,
  activeListId,
  onTarefasPage,
}: {
  list: TaskListWithMeta
  activeListId: string | null
  onTarefasPage: boolean
}) {
  const isActive = onTarefasPage && activeListId === list.id
  const colorClass = TASK_LIST_COLORS[list.color as TaskListColor]?.hash || 'text-muted-foreground'

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={list.name}
        className={cn(
          'rounded-xl transition-all duration-150 gap-2',
          isActive
            ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
            : 'hover:bg-muted/60',
        )}
      >
        <Link href={`/dashboard/tarefas?list=${list.id}`}>
          <Hash className={cn('size-4 shrink-0', isActive ? '' : colorClass)} strokeWidth={2.5} />
          <span className="text-[13px] flex-1 truncate">{list.name}</span>
          {!list.is_owner && (
            <Users className={cn('h-3 w-3 shrink-0', isActive ? 'opacity-70' : 'text-muted-foreground/60')} />
          )}
          {list.pending_count > 0 && (
            <span className={cn(
              'text-[10px] tabular-nums shrink-0',
              isActive ? 'opacity-70' : 'text-muted-foreground/70',
            )}>
              {list.pending_count}
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

