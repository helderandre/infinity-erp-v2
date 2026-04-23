'use client'


import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckSquare, Workflow, ListChecks, Plus, Hash, Users, UserPlus, MoreHorizontal, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TaskFilters } from '@/components/tasks/task-filters'
import { TaskSections } from '@/components/tasks/task-sections'
import { TaskQuickAdd } from '@/components/tasks/task-quick-add'
import { TaskForm } from '@/components/tasks/task-form'
import { TaskDetailContent } from '@/components/tasks/task-detail-sheet'
import { ProcessTaskContent } from '@/components/tasks/process-task-content'
import { VisitProposalContent } from '@/components/booking/visit-proposal-sheet'
import { ShareListDialog } from '@/components/tasks/share-list-dialog'
import { TaskListSwitcher } from '@/components/tasks/task-list-switcher'
import { useTasks, useTaskStats, useTaskMutations } from '@/hooks/use-tasks'
import { useTaskList, useTaskListMutations } from '@/hooks/use-task-lists'
import { useUser } from '@/hooks/use-user'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { peekPrefill, clearPrefill } from '@/lib/voice/prefill'
import { TASK_LIST_COLORS, type TaskListColor } from '@/types/task-list'
import type { TaskWithRelations } from '@/types/task'

type TasksTab = 'personal' | 'process'

type Selection =
  | { kind: 'task'; id: string }
  | { kind: 'proc'; task: TaskWithRelations }
  | { kind: 'proposal'; visitId: string }
  | null

function TarefasPageInner() {
  const { user } = useUser()
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const router = useRouter()
  const listId = searchParams.get('list')
  const [consultants, setConsultants] = useState<Array<{ id: string; commercial_name: string }>>([])
  const [showForm, setShowForm] = useState(false)
  const [selection, setSelection] = useState<Selection>(null)
  const [formDefaults, setFormDefaults] = useState<
    | {
        parent_task_id?: string
        title?: string
        description?: string
        priority?: number
        due_date?: string
        task_list_id?: string
        section?: string
      }
    | undefined
  >()
  const [activeTab, setActiveTab] = useState<TasksTab>('personal')
  const [shareOpen, setShareOpen] = useState(false)

  // ── Standard tabs (todo + process) ──
  const personalTab = useTasks(
    { is_completed: 'false', source_filter: 'personal' },
    { enabled: !listId },
  )
  const processTab = useTasks(
    { is_completed: 'false', source_filter: 'process' },
    { enabled: !listId },
  )

  // ── List view (when ?list=uuid) ──
  const listTab = useTasks(
    listId ? { is_completed: 'false', task_list_id: listId } : undefined,
    { enabled: !!listId },
  )
  const { list, refetch: refetchList } = useTaskList(listId)
  const { update: updateList, remove: removeList } = useTaskListMutations()

  const refetch = listId
    ? listTab.refetch
    : activeTab === 'personal' ? personalTab.refetch : processTab.refetch
  const { refetch: refetchStats } = useTaskStats()
  const { toggleComplete } = useTaskMutations()

  useEffect(() => {
    fetch('/api/users/consultants')
      .then((res) => res.json())
      .then((data) => setConsultants(data.data || data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const taskId = params.get('task')
    if (taskId) setSelection({ kind: 'task', id: taskId })

    if (params.get('new') === '1') {
      const prefill = peekPrefill<{
        title?: string
        description?: string
        priority?: number
        due_date?: string
      }>('task')
      clearPrefill('task')
      setFormDefaults(prefill ?? undefined)
      setShowForm(true)
      // Strip the ?new=1 so reloads don't reopen the form
      const url = new URL(window.location.href)
      url.searchParams.delete('new')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const handleToggleComplete = async (id: string, isCompleted: boolean) => {
    if (id.startsWith('proc_task:') || id.startsWith('proc_subtask:')) {
      toast.info('Conclui esta tarefa no detalhe do processo.')
      return
    }
    try {
      await toggleComplete(id, isCompleted)
      toast.success(isCompleted ? 'Tarefa reaberta' : 'Tarefa concluída')
      refetch()
      refetchStats()
    } catch {
      toast.error('Erro ao actualizar tarefa')
    }
  }

  const handleSelectTask = (task: TaskWithRelations) => {
    if (task.source === 'proc_task' || task.source === 'proc_subtask') {
      setSelection({ kind: 'proc', task })
      return
    }
    if (task.source === 'visit_proposal' && task.visit_id) {
      setSelection({ kind: 'proposal', visitId: task.visit_id })
      return
    }
    setSelection({ kind: 'task', id: task.id })
  }

  const isTaskSelected = (task: TaskWithRelations): boolean => {
    if (!selection) return false
    if (selection.kind === 'task') return selection.id === task.id
    if (selection.kind === 'proc') return selection.task.id === task.id
    if (selection.kind === 'proposal') return task.visit_id === selection.visitId
    return false
  }

  const handleCreateSubTask = (parentId: string) => {
    setFormDefaults({ parent_task_id: parentId })
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    refetch()
    refetchStats()
    setFormDefaults(undefined)
  }

  const handleRefresh = () => {
    refetch()
    refetchStats()
  }

  const closeSelection = () => setSelection(null)

  // Desktop inline detail panel (aparece ao lado da lista em md+)
  const detailPanel = (
    <div className="hidden lg:block lg:sticky lg:top-4">
      {selection ? (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden h-[calc(100vh-6rem)] animate-in fade-in slide-in-from-right-2 duration-200">
          {selection.kind === 'task' && (
            <TaskDetailContent
              taskId={selection.id}
              variant="inline"
              onRefresh={handleRefresh}
              onCreateSubTask={handleCreateSubTask}
              onClose={closeSelection}
            />
          )}
          {selection.kind === 'proc' && (
            <ProcessTaskContent
              task={selection.task}
              variant="inline"
              onClose={closeSelection}
            />
          )}
          {selection.kind === 'proposal' && (
            <VisitProposalContent
              visitId={selection.visitId}
              variant="inline"
              onRefresh={handleRefresh}
              onClose={closeSelection}
            />
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-muted/20 h-[calc(100vh-6rem)] flex flex-col items-center justify-center p-10 text-center">
          <CheckSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Selecciona uma tarefa para ver os detalhes
          </p>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Single header row: switcher + tabs + list actions (when in a list) */}
      <div className="flex items-center gap-2 flex-wrap">
        <TaskListSwitcher
          activeListId={listId}
          activeListName={list?.name}
          activeListColor={(list?.color as TaskListColor | undefined) ?? 'neutral'}
          defaultViewLabel="Listas"
        />

        {/* Pill picker — only when NOT inside a list (processes don't apply to lists) */}
        {!listId && (
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
            {([
              { key: 'personal' as const, label: 'Tarefas', icon: ListChecks, count: personalTab.total },
              { key: 'process' as const, label: 'Processos', icon: Workflow, count: processTab.total },
            ]).map((t) => {
              const Icon = t.icon
              const isActive = activeTab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    'px-3.5 sm:px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5',
                    isActive
                      ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className={cn(!isActive && 'hidden sm:inline')}>{t.label}</span>
                  {t.count > 0 && (
                    <span
                      className={cn(
                        'ml-0.5 rounded-full px-1.5 text-[10px] font-semibold leading-4',
                        isActive
                          ? 'bg-white/20 text-white dark:bg-neutral-900/10 dark:text-neutral-900'
                          : 'bg-muted text-muted-foreground hidden sm:inline',
                      )}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Member avatars + list actions — only when inside a list */}
        {listId && list && (
          <ListInlineActions
            list={list}
            onShare={() => setShareOpen(true)}
            onRenamed={async (name) => { await updateList(list.id, { name }); refetchList() }}
            onColorChanged={async (color) => { await updateList(list.id, { color }); refetchList() }}
            onDeleted={async () => {
              await removeList(list.id)
              toast.success('Lista eliminada')
              router.push('/dashboard/tarefas')
            }}
          />
        )}
      </div>

      {/* Share dialog */}
      {listId && list && (
        <ShareListDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          listId={listId}
          listName={list.name}
          currentMembers={list.members || []}
          ownerId={list.owner_id}
          onChanged={refetchList}
        />
      )}

      {/* Personal tasks (or list-filtered tasks) — same layout, the list is just a filter */}
      {(listId || activeTab === 'personal') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="rounded-2xl border bg-card shadow-sm p-3 space-y-3">
            <TaskFilters
              filters={listId ? listTab.filters : personalTab.filters}
              onFiltersChange={listId ? listTab.setFilters : personalTab.setFilters}
              onNewTask={() => { setFormDefaults(listId ? { task_list_id: listId } : undefined); setShowForm(true) }}
              consultants={consultants}
              currentUserId={user?.id}
            />
            <TaskQuickAdd
              key={listId || 'none'}
              taskListId={listId || undefined}
              onCreated={() => {
                if (listId) { listTab.refetch(); refetchList() }
                else { personalTab.refetch() }
                refetchStats()
              }}
              onOpenFullForm={() => {
                setFormDefaults(listId ? { task_list_id: listId } : undefined)
                setShowForm(true)
              }}
              placeholder={listId && list ? `Adicionar tarefa a ${list.name}...` : undefined}
            />
            <TaskList
              tasks={listId ? listTab.tasks : personalTab.tasks}
              isLoading={listId ? listTab.isLoading : personalTab.isLoading}
              isCompletedFilter={(listId ? listTab.filters : personalTab.filters).is_completed}
              onToggleComplete={handleToggleComplete}
              onSelect={handleSelectTask}
              onRefresh={() => {
                if (listId) { listTab.refetch(); refetchList() }
                else { personalTab.refetch() }
                refetchStats()
              }}
              onCreate={() => {
                setFormDefaults(listId ? { task_list_id: listId } : undefined)
                setShowForm(true)
              }}
              emptyMessage={listId ? 'Lista vazia. Começa por adicionar uma tarefa em cima.' : 'Todas as tarefas estão em dia!'}
              isSelected={isTaskSelected}
            />
            {(listId ? listTab.total : personalTab.total) > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                A mostrar {(listId ? listTab.tasks : personalTab.tasks).length} de {listId ? listTab.total : personalTab.total} tarefa{(listId ? listTab.total : personalTab.total) !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {detailPanel}
        </div>
      )}

      {!listId && activeTab === 'process' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="rounded-2xl border bg-card shadow-sm p-3 space-y-3">
            <TaskFilters
              filters={processTab.filters}
              onFiltersChange={processTab.setFilters}
              onNewTask={() => { setFormDefaults(undefined); setShowForm(true) }}
              consultants={consultants}
              currentUserId={user?.id}
            />
            <TaskList
              tasks={processTab.tasks}
              isLoading={processTab.isLoading}
              isCompletedFilter={processTab.filters.is_completed}
              onToggleComplete={handleToggleComplete}
              onSelect={handleSelectTask}
              onRefresh={() => { processTab.refetch(); refetchStats() }}
              onCreate={() => { setFormDefaults(undefined); setShowForm(true) }}
              emptyMessage="Sem tarefas de processos pendentes."
              isSelected={isTaskSelected}
            />
            {processTab.total > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                A mostrar {processTab.tasks.length} de {processTab.total} tarefa{processTab.total !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {detailPanel}
        </div>
      )}

      {/* Form dialog */}
      <TaskForm
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) setFormDefaults(undefined) }}
        onSuccess={handleFormSuccess}
        consultants={consultants}
        defaultValues={formDefaults}
      />

      {/* Mobile detail sheet — em desktop a detail aparece inline no split-view.
          Em mobile sobe do fundo (bottom sheet) com cantos arredondados no topo. */}
      <Sheet
        open={!!selection && isMobile}
        onOpenChange={(open) => { if (!open) closeSelection() }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="h-[90vh] max-h-[90vh] p-0 flex flex-col rounded-t-2xl border-t-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Detalhe</SheetTitle>
          </SheetHeader>
          {/* Grip indicator — afinidade com bottom sheets nativas */}
          <div className="flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
          </div>
          {selection?.kind === 'task' && (
            <TaskDetailContent
              taskId={selection.id}
              variant="inline"
              onRefresh={handleRefresh}
              onCreateSubTask={handleCreateSubTask}
              onClose={closeSelection}
            />
          )}
          {selection?.kind === 'proc' && (
            <ProcessTaskContent
              task={selection.task}
              variant="inline"
              onClose={closeSelection}
            />
          )}
          {selection?.kind === 'proposal' && (
            <VisitProposalContent
              visitId={selection.visitId}
              variant="inline"
              onRefresh={handleRefresh}
              onClose={closeSelection}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Task List (shared between tabs) ─────────────────────────

function TaskList({
  tasks,
  isLoading,
  isCompletedFilter,
  onToggleComplete,
  onSelect,
  onRefresh,
  onCreate,
  emptyMessage,
  isSelected,
}: {
  tasks: TaskWithRelations[]
  isLoading: boolean
  isCompletedFilter?: 'true' | 'false'
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onSelect: (task: TaskWithRelations) => void
  onRefresh: () => void
  onCreate: () => void
  emptyMessage: string
  isSelected: (task: TaskWithRelations) => boolean
}) {
  if (isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-2.5 py-2 border-b border-border/50 last:border-b-0">
            <Skeleton className="size-[18px] rounded-full shrink-0 mt-[3px]" />
            <div className="flex-1 space-y-1.5 pt-0.5">
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-2.5 w-2/5" />
            </div>
            <Skeleton className="size-3.5 rounded shrink-0 mt-[3px]" />
          </div>
        ))}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium">Sem tarefas</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isCompletedFilter === 'true' ? 'Nenhuma tarefa concluída encontrada.' : emptyMessage}
        </p>
        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" />
          Criar tarefa
        </Button>
      </div>
    )
  }

  return (
    <TaskSections
      tasks={tasks}
      onToggleComplete={onToggleComplete}
      onSelect={onSelect}
      onRefresh={onRefresh}
      isSelected={isSelected}
    />
  )
}

// ─── List Header (inside a task list) ───────────────────────

function ListInlineActions({
  list,
  onShare,
  onRenamed,
  onColorChanged,
  onDeleted,
}: {
  list: {
    id: string
    name: string
    color: string
    is_owner: boolean
    members?: Array<{ user_id: string; commercial_name: string; profile_photo_url?: string | null }>
  }
  onShare: () => void
  onRenamed: (name: string) => Promise<void>
  onColorChanged: (color: string) => Promise<void>
  onDeleted: () => Promise<void>
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [name, setName] = useState(list.name)
  const avatars = (list.members || []).slice(0, 3)
  const memberCount = list.members?.length ?? 0

  const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  const commitRename = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === list.name) { setRenameOpen(false); setName(list.name); return }
    try { await onRenamed(trimmed) } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao renomear')
      setName(list.name)
    } finally { setRenameOpen(false) }
  }

  return (
    <>
      {/* Member avatars (shared lists) */}
      {avatars.length > 0 && (
        <div className="flex -space-x-1.5">
          {avatars.map((m) => (
            <Avatar key={m.user_id} className="size-6 border-2 border-background">
              <AvatarImage src={m.profile_photo_url || undefined} />
              <AvatarFallback className="text-[9px]">{initials(m.commercial_name)}</AvatarFallback>
            </Avatar>
          ))}
          {memberCount > avatars.length && (
            <div className="size-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[9px] font-medium text-muted-foreground">
              +{memberCount - avatars.length}
            </div>
          )}
        </div>
      )}

      {/* Owner-only actions */}
      {list.is_owner && (
        <>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center justify-center size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Partilhar"
          >
            <UserPlus className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                aria-label="Mais acções"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => { setName(list.name); setRenameOpen(true) }}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                Cor
              </div>
              <div className="flex flex-wrap gap-1 px-2 pb-2">
                {(Object.entries(TASK_LIST_COLORS) as [TaskListColor, typeof TASK_LIST_COLORS[TaskListColor]][]).map(([key, c]) => (
                  <button
                    key={key}
                    onClick={() => onColorChanged(key)}
                    className={cn(
                      'size-6 rounded-full hover:bg-muted/60 flex items-center justify-center',
                      list.color === key && 'ring-2 ring-primary/40',
                    )}
                    title={c.label}
                  >
                    <Hash className={cn('size-3.5', c.hash)} strokeWidth={2.5} />
                  </button>
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Eliminar lista
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear lista</DialogTitle>
          </DialogHeader>
          <input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename() }
              if (e.key === 'Escape') { setRenameOpen(false); setName(list.name) }
            }}
            className="w-full text-sm h-9 rounded-md border border-input bg-transparent px-3 py-1 outline-none focus:ring-2 focus:ring-ring"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRenameOpen(false); setName(list.name) }}>Cancelar</Button>
            <Button onClick={commitRename}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar lista</AlertDialogTitle>
            <AlertDialogDescription>
              As tarefas desta lista não serão eliminadas — apenas deixam de estar agrupadas.
              Esta acção é irreversível para a lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { await onDeleted() }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function TarefasPage() {
  return (
    <Suspense fallback={null}>
      <TarefasPageInner />
    </Suspense>
  )
}

