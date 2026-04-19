'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { MobileFilterSheet } from '@/components/shared/mobile-filter-sheet'
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
}

export function ProcessPipelinePanel({ processId, className, onProcessChange }: ProcessPipelinePanelProps) {
  const { user } = useUser()

  const [process, setProcess] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('foco')

  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterRole, setFilterRole] = useState<string>('all')

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

  const { filteredStages, assignees, roles, progressPercent, totalTasks } = useMemo(() => {
    if (!process?.stages) {
      return {
        filteredStages: [] as ProcessStageWithTasks[],
        assignees: [] as { id: string; name: string }[],
        roles: [] as string[],
        progressPercent: 0,
        totalTasks: 0,
      }
    }
    const allTasks: ProcessTask[] = process.stages.flatMap((s: ProcessStageWithTasks) => s.tasks)
    const assigneeMap = new Map<string, string>()
    const roleSet = new Set<string>()
    let total = 0
    let completedWeight = 0
    for (const t of allTasks) {
      total++
      const isComplete = t.status === 'completed' || t.status === 'skipped'
      if (isComplete) {
        completedWeight++
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

  return (
    <div className={cn('space-y-4', className)}>
      {totalTasks > 0 && (
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

      <div className="flex items-center gap-2">
        <MobileFilterSheet
          activeCount={
            (filterStatus !== 'all' ? 1 : 0) +
            (filterPriority !== 'all' ? 1 : 0) +
            (filterAssignee !== 'all' ? 1 : 0) +
            (filterRole !== 'all' ? 1 : 0)
          }
        >
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] h-8 rounded-full text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[150px] h-8 rounded-full text-xs">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as prioridades</SelectItem>
              {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-[170px] h-8 rounded-full text-xs">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {assignees.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {roles.length > 0 && (
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[180px] h-8 rounded-full text-xs">
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
          )}
        </MobileFilterSheet>

        <div className="ml-auto flex items-center gap-2">
          {canCreateAdhoc && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAdhocPreselectedStage(undefined)
                setAdhocTaskSheetOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova Tarefa
            </Button>
          )}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as ViewMode)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="foco" aria-label="Vista Foco">
              <Target className="h-4 w-4" />
              Foco
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Vista Kanban">
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </ToggleGroupItem>
            <ToggleGroupItem value="timeline" aria-label="Vista Timeline">
              <Activity className="h-4 w-4" />
              Timeline
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {viewMode === 'foco' ? (
        <ProcessFocusView
          stages={filteredStages}
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
