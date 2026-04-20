'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Activity, Ban, Kanban, LayoutGrid, Plus, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ProcessFocusView } from '@/components/processes/process-focus-view'
import { ProcessKanbanView } from '@/components/processes/process-kanban-view'
import { ProcessTimelineView } from '@/components/processes/process-timeline-view'
import { ProcessTaskAssignDialog } from '@/components/processes/process-task-assign-dialog'
import { StageCompleteDialog } from '@/components/processes/stage-complete-dialog'
import { TaskDetailSheet } from '@/components/processes/task-detail-sheet'
import { AdHocTaskSheet } from '@/components/processes/adhoc-task-sheet'
import { FloatingChat } from '@/components/processes/floating-chat'
import { useUser } from '@/hooks/use-user'
import { useProcessActivities } from '@/hooks/use-process-activities'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, getRoleBadgeColors } from '@/lib/constants'
import { ADHOC_TASK_ROLES } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import type { ProcessStageWithTasks, ProcessTask } from '@/types/process'

type ViewMode = 'foco' | 'kanban' | 'timeline'

interface ProcessPipelinePanelProps {
  processId: string
  className?: string
  onProcessChange?: () => void
  /** Optional DOM slot to portal the right-side toolbar (view picker + filters + add) into. */
  toolbarElement?: HTMLElement | null
}

export function ProcessPipelinePanel({ processId, className, onProcessChange, toolbarElement }: ProcessPipelinePanelProps) {
  const { user } = useUser()

  const [process, setProcess] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('foco')

  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [focusStageId, setFocusStageId] = useState<string | null>(null)
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null)
  const manualTaskIdRef = useRef<string | null>(null)

  const [bypassDialogOpen, setBypassDialogOpen] = useState(false)
  const [bypassTask, setBypassTask] = useState<ProcessTask | null>(null)
  const [bypassReason, setBypassReason] = useState('')

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignTask, setAssignTask] = useState<ProcessTask | null>(null)

  const [selectedTask, setSelectedTask] = useState<ProcessTask | null>(null)

  const [adhocTaskSheetOpen, setAdhocTaskSheetOpen] = useState(false)
  const [adhocPreselectedStage, setAdhocPreselectedStage] = useState<
    { name: string; order_index: number } | undefined
  >()

  const [deleteTaskTarget, setDeleteTaskTarget] = useState<ProcessTask | null>(null)
  const [isDeletingTask, setIsDeletingTask] = useState(false)

  const [stageCompleteTarget, setStageCompleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [isCompletingStage, setIsCompletingStage] = useState(false)

  const { activities: processActivities, isLoading: isLoadingActivities } = useProcessActivities(
    viewMode === 'timeline' ? processId : null
  )

  const loadProcess = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true)
      try {
        const res = await fetch(`/api/processes/${processId}`)
        if (!res.ok) throw new Error('Processo não encontrado')
        const data = await res.json()
        setProcess(data)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar processo')
      } finally {
        if (!silent) setIsLoading(false)
      }
    },
    [processId],
  )

  useEffect(() => {
    loadProcess()
  }, [loadProcess])

  const silentRefresh = useCallback(() => {
    loadProcess(true)
    onProcessChange?.()
  }, [loadProcess, onProcessChange])

  const handleTaskAction = useCallback(
    async (taskId: string, action: string) => {
      setIsProcessing(true)
      try {
        const res = await fetch(`/api/processes/${processId}/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erro ao actualizar tarefa')
        }
        toast.success('Tarefa actualizada com sucesso!')
        silentRefresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao actualizar tarefa')
      } finally {
        setIsProcessing(false)
      }
    },
    [processId, silentRefresh],
  )

  const handleBypassOpen = useCallback((task: ProcessTask) => {
    setBypassTask(task)
    setBypassReason('')
    setBypassDialogOpen(true)
  }, [])

  const handleBypassSubmit = useCallback(async () => {
    if (!bypassTask || bypassReason.length < 10) return
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/processes/${processId}/tasks/${bypassTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bypass', bypass_reason: bypassReason }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao dispensar tarefa')
      }
      toast.success('Tarefa dispensada com sucesso!')
      setBypassDialogOpen(false)
      setBypassTask(null)
      setBypassReason('')
      silentRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao dispensar tarefa')
    } finally {
      setIsProcessing(false)
    }
  }, [bypassTask, bypassReason, processId, silentRefresh])

  const handleAssignOpen = useCallback((task: ProcessTask) => {
    setAssignTask(task)
    setAssignDialogOpen(true)
  }, [])

  const handleTaskClick = useCallback((task: ProcessTask) => {
    setSelectedTask(task)
  }, [])

  const handleDeleteAdhocTask = useCallback(async () => {
    if (!deleteTaskTarget) return
    setIsDeletingTask(true)
    try {
      const res = await fetch(`/api/processes/${processId}/tasks/${deleteTaskTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao remover tarefa')
      }
      toast.success('Tarefa removida com sucesso!')
      setDeleteTaskTarget(null)
      silentRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover tarefa')
    } finally {
      setIsDeletingTask(false)
    }
  }, [deleteTaskTarget, processId, silentRefresh])

  const handleStageCompleteOpen = useCallback(
    (stageId: string) => {
      const stage = process?.stages?.find((s: any) => s.id === stageId)
      if (stage) setStageCompleteTarget({ id: stageId, name: stage.name })
    },
    [process],
  )

  const handleStageComplete = useCallback(async () => {
    if (!stageCompleteTarget) return
    setIsCompletingStage(true)
    try {
      const res = await fetch(
        `/api/processes/${processId}/stages/${stageCompleteTarget.id}/complete`,
        { method: 'POST' },
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao concluir estágio')
      }
      toast.success('Estágio concluído com sucesso!')
      setStageCompleteTarget(null)
      silentRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao concluir estágio')
    } finally {
      setIsCompletingStage(false)
    }
  }, [stageCompleteTarget, processId, silentRefresh])

  const handleEntityClick = useCallback(
    (entityType: string, entityId: string) => {
      if (!process?.stages) return
      const allTasks: ProcessTask[] = process.stages.flatMap((s: ProcessStageWithTasks) => s.tasks)
      if (entityType === 'task') {
        const task = allTasks.find((t) => t.id === entityId)
        if (task) setSelectedTask(task)
      } else if (entityType === 'subtask') {
        const parent = allTasks.find((t) =>
          t.subtasks?.some((st: { id: string }) => st.id === entityId),
        )
        if (parent) setSelectedTask(parent)
      } else if (entityType === 'doc') {
        const linked = allTasks.find((t) => {
          const r = t.task_result as Record<string, unknown> | null
          return r?.doc_registry_id === entityId
        })
        if (linked) setSelectedTask(linked)
      }
    },
    [process?.stages],
  )

  useEffect(() => {
    if (selectedTask && process?.stages) {
      const all: ProcessTask[] = process.stages.flatMap((s: ProcessStageWithTasks) => s.tasks)
      const updated = all.find((t) => t.id === selectedTask.id)
      setSelectedTask(updated ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process?.stages])

  const { filteredStages, assignees, roles, progressPercent, totalTasks, completedTasks } = useMemo(() => {
    if (!process?.stages) {
      return {
        filteredStages: [] as ProcessStageWithTasks[],
        assignees: [] as { id: string; name: string }[],
        roles: [] as string[],
        progressPercent: 0,
        totalTasks: 0,
        completedTasks: 0,
      }
    }
    const allTasks: ProcessTask[] = process.stages.flatMap((s: ProcessStageWithTasks) => s.tasks)
    const assigneeMap = new Map<string, string>()
    const roleSet = new Set<string>()
    let total = 0
    let completedWeight = 0
    let completedFull = 0
    for (const t of allTasks) {
      total++
      const isComplete = t.status === 'completed' || t.status === 'skipped'
      if (isComplete) {
        completedWeight++
        completedFull++
      } else if (t.subtasks && t.subtasks.length > 0) {
        const done = t.subtasks.filter((s) => s.is_completed).length
        completedWeight += done / t.subtasks.length
      }
      if (t.assigned_to_user) assigneeMap.set(t.assigned_to_user.id, t.assigned_to_user.commercial_name)
      if (t.assigned_role) roleSet.add(t.assigned_role)
    }
    const filtered = (process.stages as ProcessStageWithTasks[])
      .map((stage) => ({
        ...stage,
        tasks: stage.tasks.filter((t) => {
          if (filterStatus !== 'all' && t.status !== filterStatus) return false
          if (filterPriority !== 'all' && (t.priority ?? 'normal') !== filterPriority) return false
          if (filterAssignee !== 'all' && t.assigned_to_user?.id !== filterAssignee) return false
          if (filterRole !== 'all' && t.assigned_role !== filterRole) return false
          return true
        }),
      }))
      .filter((s) => s.tasks.length > 0)
    return {
      filteredStages: filtered,
      assignees: Array.from(assigneeMap.entries()).map(([id, name]) => ({ id, name })),
      roles: Array.from(roleSet).sort(),
      progressPercent: total > 0 ? Math.round((completedWeight / total) * 100) : 0,
      totalTasks: total,
      completedTasks: completedFull,
    }
  }, [process?.stages, filterStatus, filterPriority, filterAssignee, filterRole])

  const instance = process?.instance
  const isActive = instance ? ['active', 'on_hold', 'completed'].includes(instance.current_status) : false
  const canDeleteAdhoc = !!user?.role?.name && ADHOC_TASK_ROLES.includes(user.role.name as any)
  const canCreateAdhoc =
    !!user?.role?.name &&
    ADHOC_TASK_ROLES.includes(user.role.name as any) &&
    !!instance &&
    ['active', 'on_hold'].includes(instance.current_status)

  // Sorted stages (by order_index) for stage dropdown + default-stage resolution
  const sortedStages = useMemo(
    () => [...filteredStages].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [filteredStages],
  )

  const resolvedStageId = useMemo(() => {
    if (sortedStages.length === 0) return null
    if (focusStageId && sortedStages.some((s) => s.id === focusStageId)) return focusStageId
    // Auto-pick: first stage with a pending task, else first future stage, else last
    const current = sortedStages.find((s) => s.tasks.some((t) => t.status !== 'completed' && t.status !== 'skipped'))
    if (current) return current.id
    return sortedStages[sortedStages.length - 1].id
  }, [sortedStages, focusStageId])

  const focusStage = resolvedStageId
    ? sortedStages.find((s) => s.id === resolvedStageId) ?? null
    : null

  // Sorted tasks within the selected stage (for task pills + card pair)
  const sortedTasks = useMemo(
    () =>
      focusStage
        ? [...focusStage.tasks].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        : [],
    [focusStage],
  )

  const resolvedTaskId = useMemo(() => {
    if (sortedTasks.length === 0) return null
    if (focusTaskId && sortedTasks.some((t) => t.id === focusTaskId)) return focusTaskId
    const firstPending = sortedTasks.find((t) => t.status !== 'completed' && t.status !== 'skipped')
    return firstPending?.id ?? sortedTasks[0].id
  }, [sortedTasks, focusTaskId])

  const focusTask = resolvedTaskId
    ? sortedTasks.find((t) => t.id === resolvedTaskId) ?? null
    : null

  // The task that represents the stage's current completion point — the first
  // non-completed task. This is what gets the "you are here" pulse in the picker,
  // independent of whichever task the user is currently viewing.
  const completionTaskId = useMemo(() => {
    if (sortedTasks.length === 0) return null
    const firstPending = sortedTasks.find((t) => t.status !== 'completed' && t.status !== 'skipped')
    return firstPending?.id ?? null
  }, [sortedTasks])

  // Reset task selection when stage changes
  useEffect(() => {
    setFocusTaskId(null)
    manualTaskIdRef.current = null
  }, [resolvedStageId])

  // Auto-advance: if the currently selected task just completed AND user hadn't manually picked it,
  // move to the next pending task in the same stage.
  useEffect(() => {
    if (!focusTask || !sortedTasks.length) return
    const isDone = focusTask.status === 'completed' || focusTask.status === 'skipped'
    if (isDone && manualTaskIdRef.current !== focusTask.id) {
      const nextPending = sortedTasks.find(
        (t) => t.status !== 'completed' && t.status !== 'skipped',
      )
      if (nextPending && nextPending.id !== focusTask.id) {
        setFocusTaskId(nextPending.id)
      }
    }
  }, [focusTask, sortedTasks])

  const handleFocusTaskChange = useCallback((id: string) => {
    manualTaskIdRef.current = id
    setFocusTaskId(id)
  }, [])

  const activeFiltersCount =
    (filterStatus !== 'all' ? 1 : 0) +
    (filterPriority !== 'all' ? 1 : 0) +
    (filterAssignee !== 'all' ? 1 : 0) +
    (filterRole !== 'all' ? 1 : 0)

  if (isLoading && !process) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!process || !instance) return null

  if (!isActive || !process.stages || process.stages.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Kanban className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Pipeline não disponível</p>
          <p className="text-xs mt-1">O processo precisa de ser aprovado antes de ter tarefas.</p>
        </CardContent>
      </Card>
    )
  }

  // ── Right cluster: View picker + Filtros + Plus ─────────────────────
  // Extracted so it can either render inline (default) or be portaled into a
  // parent-provided slot (e.g. the imóveis page sub-tab row).
  const rightToolbar = (
    <>
      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(v) => v && setViewMode(v as ViewMode)}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="foco" aria-label="Vista Foco">
          <Target className="h-4 w-4" />
          <span className="hidden sm:inline">Foco</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="kanban" aria-label="Vista Kanban">
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">Kanban</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="timeline" aria-label="Vista Timeline">
          <Activity className="h-4 w-4" />
          <span className="hidden sm:inline">Timeline</span>
        </ToggleGroupItem>
      </ToggleGroup>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full px-3">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-4 min-w-4 px-1 rounded-full text-[9px]">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-[280px] p-3 space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Estado</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Prioridade</Label>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Responsável</Label>
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {roles.length > 0 && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Papel</Label>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os papéis</SelectItem>
                  {roles.map((role) => {
                    const rc = getRoleBadgeColors(role)
                    return (
                      <SelectItem key={role} value={role}>
                        <span className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full shrink-0', rc.bg, rc.border, 'border')} />
                          {role}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-7"
              onClick={() => {
                setFilterStatus('all')
                setFilterPriority('all')
                setFilterAssignee('all')
                setFilterRole('all')
              }}
            >
              Limpar filtros
            </Button>
          )}
        </PopoverContent>
      </Popover>
      {canCreateAdhoc && (
        <Button
          size="icon"
          variant="default"
          className="h-8 w-8 rounded-full"
          onClick={() => {
            setAdhocPreselectedStage(undefined)
            setAdhocTaskSheetOpen(true)
          }}
          title="Nova Tarefa"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </>
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* Right toolbar: portal into parent-provided slot when available, else render inline */}
      {toolbarElement
        ? createPortal(rightToolbar, toolbarElement)
        : null}

      {/* ── Controls row (above progress bar) ──────────────────────── */}
      {(viewMode === 'foco' && focusStage) || !toolbarElement ? (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stage selector + task pills — only when Foco view is active */}
          {viewMode === 'foco' && focusStage && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted transition-colors"
                  >
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-primary-foreground px-1.5 text-[10px] font-bold">
                      {String(sortedStages.findIndex((s) => s.id === focusStage.id) + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate max-w-[260px]">{focusStage.name}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[320px]">
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground">Fases</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {sortedStages.map((stage, i) => {
                    const done = stage.tasks_completed
                    const total = stage.tasks_total
                    const isDone = total > 0 && done === total
                    const isCurrent = stage.is_current || stage.tasks.some((t) => t.status !== 'completed' && t.status !== 'skipped')
                    return (
                      <DropdownMenuItem
                        key={stage.id}
                        onClick={() => setFocusStageId(stage.id)}
                        className={cn('flex items-start gap-2 py-2', stage.id === focusStage.id && 'bg-accent')}
                      >
                        <span
                          className={cn(
                            'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                            isDone && 'bg-emerald-500/15 text-emerald-700',
                            !isDone && isCurrent && 'bg-primary text-primary-foreground',
                            !isDone && !isCurrent && 'bg-muted text-muted-foreground',
                          )}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{stage.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {isDone ? 'Concluída' : isCurrent ? 'Em curso' : 'Por iniciar'}
                            {total > 0 && ` · ${done}/${total}`}
                          </div>
                        </div>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Task pills — now on the right side of the stage row */}
              {sortedTasks.length > 1 && (
                <div className="ml-auto flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-3 -my-2">
                  {sortedTasks.map((task, i) => {
                    const isDone = task.status === 'completed' || task.status === 'skipped'
                    const isSelected = focusTask?.id === task.id
                    const isCompletionCurrent = task.id === completionTaskId
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => handleFocusTaskChange(task.id)}
                        title={task.title}
                        className={cn(
                          'inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2.5 text-[11px] font-semibold tabular-nums transition-all',
                          isSelected
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm dark:bg-white dark:text-neutral-900 dark:border-white'
                            : isDone
                              ? 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
                              : 'bg-card text-foreground border-border hover:border-primary/40',
                          isCompletionCurrent && 'animate-focus-step-pulse',
                        )}
                        aria-current={isSelected ? 'step' : undefined}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Inline-fallback right toolbar: only when no parent slot provided */}
          {!toolbarElement && (
            <div className="ml-auto flex items-center gap-2">{rightToolbar}</div>
          )}
        </div>
      ) : null}

      {/* Progress bar — shown at panel root for Kanban/Timeline; inside the Foco left card otherwise */}
      {totalTasks > 0 && viewMode !== 'foco' && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500 rounded-full',
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-primary',
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {progressPercent}%
          </span>
        </div>
      )}

      {viewMode === 'foco' ? (
        <ProcessFocusView
          stage={focusStage}
          tasks={sortedTasks}
          activeTaskId={focusTask?.id ?? null}
          onTaskChange={handleFocusTaskChange}
          instance={instance}
          property={instance.property}
          owners={process.owners}
          documents={process.documents}
          deal={process.deal}
          onTaskUpdate={silentRefresh}
        />
      ) : viewMode === 'kanban' ? (
        <ProcessKanbanView
          stages={filteredStages}
          isProcessing={isProcessing}
          canDeleteAdhoc={canDeleteAdhoc}
          onTaskAction={handleTaskAction}
          onTaskBypass={handleBypassOpen}
          onTaskAssign={handleAssignOpen}
          onTaskClick={handleTaskClick}
          onTaskDelete={(task) => setDeleteTaskTarget(task)}
          onStageComplete={handleStageCompleteOpen}
        />
      ) : (
        <ProcessTimelineView activities={processActivities} isLoading={isLoadingActivities} />
      )}

      {user && (
        <FloatingChat
          processId={instance.id}
          currentUser={{
            id: user.id,
            name: user.commercial_name || 'Utilizador',
          }}
          onEntityClick={handleEntityClick}
        />
      )}

      {process.stages && (
        <AdHocTaskSheet
          open={adhocTaskSheetOpen}
          onOpenChange={setAdhocTaskSheetOpen}
          processId={instance.id}
          stages={process.stages}
          owners={process.owners || []}
          existingTasks={(process.stages as ProcessStageWithTasks[]).flatMap((s) => s.tasks)}
          preselectedStage={adhocPreselectedStage}
          onTaskCreated={silentRefresh}
        />
      )}

      <TaskDetailSheet
        task={selectedTask}
        processId={instance.id}
        propertyId={instance.property_id}
        consultantId={instance.requested_by ?? undefined}
        property={instance.property}
        processInstance={instance}
        processDocuments={process.documents}
        owners={process.owners}
        deal={process.deal}
        open={selectedTask !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null)
        }}
        onTaskUpdate={silentRefresh}
      />

      <Dialog open={bypassDialogOpen} onOpenChange={setBypassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispensar Tarefa</DialogTitle>
            <DialogDescription>
              Indique o motivo para dispensar esta tarefa (mínimo 10 caracteres)
            </DialogDescription>
          </DialogHeader>
          {bypassTask && (
            <div className="py-2">
              <p className="text-sm font-medium">{bypassTask.title}</p>
            </div>
          )}
          <Textarea
            placeholder="Ex: Documento não aplicável a este tipo de imóvel..."
            value={bypassReason}
            onChange={(e) => setBypassReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBypassDialogOpen(false)
                setBypassReason('')
                setBypassTask(null)
              }}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button onClick={handleBypassSubmit} disabled={isProcessing || bypassReason.length < 10}>
              <Ban className="mr-2 h-4 w-4" />
              Dispensar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {assignTask && (
        <ProcessTaskAssignDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          taskId={assignTask.id}
          taskTitle={assignTask.title}
          processId={instance.id}
          currentAssignedTo={assignTask.assigned_to}
          onAssigned={silentRefresh}
        />
      )}

      <StageCompleteDialog
        open={!!stageCompleteTarget}
        onOpenChange={(open) => !open && setStageCompleteTarget(null)}
        stageName={stageCompleteTarget?.name || ''}
        onConfirm={handleStageComplete}
        isLoading={isCompletingStage}
      />

      <AlertDialog
        open={!!deleteTaskTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTaskTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tarefa ad-hoc</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende remover a tarefa &ldquo;{deleteTaskTarget?.title}&rdquo;?
              Todas as subtarefas associadas serão também eliminadas. Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTask}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteAdhocTask}
              disabled={isDeletingTask}
            >
              {isDeletingTask ? 'A remover...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
