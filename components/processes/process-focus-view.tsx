'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock,
  Lock,
  PlayCircle,
  UserRound,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { TASK_PRIORITY_LABELS, getRoleBadgeColors } from '@/lib/constants'
import type {
  ProcessStageWithTasks,
  ProcessTask,
} from '@/types/process'

interface ProcessFocusViewProps {
  stages: ProcessStageWithTasks[]
  onOpenTask: (task: ProcessTask) => void
}

function isTaskDone(task: ProcessTask) {
  return task.status === 'completed' || task.status === 'skipped'
}

function stageIsCompleted(stage: ProcessStageWithTasks) {
  return stage.is_completed_explicit || (stage.tasks.length > 0 && stage.tasks.every(isTaskDone))
}

function getStageStatus(stage: ProcessStageWithTasks): 'past' | 'current' | 'future' {
  if (stageIsCompleted(stage)) return 'past'
  if (stage.is_current || stage.tasks.some((t) => !isTaskDone(t))) return 'current'
  return 'future'
}

function getTaskStatus(task: ProcessTask): 'past' | 'current' | 'future' {
  if (isTaskDone(task)) return 'past'
  if (task.is_blocked) return 'future'
  return 'current'
}

function pickDefaultStage(stages: ProcessStageWithTasks[]): ProcessStageWithTasks | null {
  if (stages.length === 0) return null
  const currentStage = stages.find((s) => getStageStatus(s) === 'current')
  if (currentStage) return currentStage
  // All past or all future — fallback to first non-past, else last
  const firstFuture = stages.find((s) => getStageStatus(s) === 'future')
  return firstFuture ?? stages[stages.length - 1]
}

function pickDefaultTask(stage: ProcessStageWithTasks | null): ProcessTask | null {
  if (!stage || stage.tasks.length === 0) return null
  const firstPending = stage.tasks.find((t) => !isTaskDone(t))
  return firstPending ?? stage.tasks[0]
}

function formatStageOrder(stage: ProcessStageWithTasks, allStages: ProcessStageWithTasks[]) {
  const idx = allStages.findIndex((s) => s.id === stage.id)
  return idx >= 0 ? String(idx + 1).padStart(2, '0') : '—'
}

export function ProcessFocusView({ stages, onOpenTask }: ProcessFocusViewProps) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const manualSelectionRef = useRef<{ stage?: string; task?: string }>({})

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [stages],
  )

  // Resolve currently selected stage, falling back to the natural default
  const selectedStage = useMemo(() => {
    if (selectedStageId) {
      const match = sortedStages.find((s) => s.id === selectedStageId)
      if (match) return match
    }
    return pickDefaultStage(sortedStages)
  }, [sortedStages, selectedStageId])

  const sortedTasks = useMemo(
    () =>
      selectedStage ? [...selectedStage.tasks].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)) : [],
    [selectedStage],
  )

  const selectedTask = useMemo(() => {
    if (selectedTaskId) {
      const match = sortedTasks.find((t) => t.id === selectedTaskId)
      if (match) return match
    }
    return pickDefaultTask(selectedStage)
  }, [sortedTasks, selectedStage, selectedTaskId])

  // Keep selection stable when data refreshes; auto-advance when completed
  useEffect(() => {
    if (!selectedStage) return
    if (!selectedTaskId || !sortedTasks.some((t) => t.id === selectedTaskId)) {
      const next = pickDefaultTask(selectedStage)
      if (next) setSelectedTaskId(next.id)
      return
    }
    // Auto-advance: if the currently selected task just completed AND user hadn't manually picked this task,
    // move to the next pending task.
    const current = sortedTasks.find((t) => t.id === selectedTaskId)
    if (
      current &&
      isTaskDone(current) &&
      manualSelectionRef.current.task !== selectedTaskId
    ) {
      const nextPending = sortedTasks.find((t) => !isTaskDone(t))
      if (nextPending && nextPending.id !== selectedTaskId) {
        setSelectedTaskId(nextPending.id)
      }
    }
  }, [selectedStage, sortedTasks, selectedTaskId])

  const handleStageChange = (id: string) => {
    manualSelectionRef.current = { stage: id }
    setSelectedStageId(id)
    // Reset task selection; effect will pick the default
    setSelectedTaskId(null)
  }

  const handleTaskChange = (id: string) => {
    manualSelectionRef.current = { ...manualSelectionRef.current, task: id }
    setSelectedTaskId(id)
  }

  if (sortedStages.length === 0 || !selectedStage || !selectedTask) {
    return (
      <div className="rounded-xl border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        Sem fases ou tarefas disponíveis para apresentar.
      </div>
    )
  }

  const currentStageStatus = getStageStatus(selectedStage)
  const currentTaskStatus = getTaskStatus(selectedTask)
  const stageNumber = formatStageOrder(selectedStage, sortedStages)
  const totalStages = sortedStages.length

  return (
    <div className="space-y-4">
      {/* ── Header: stage bubble (left) + task pills (right) ─────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                'bg-card hover:bg-muted shadow-sm',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                  currentStageStatus === 'past' && 'bg-emerald-500/15 text-emerald-700',
                  currentStageStatus === 'current' && 'bg-primary text-primary-foreground',
                  currentStageStatus === 'future' && 'bg-muted text-muted-foreground',
                )}
              >
                {stageNumber}
              </span>
              <span className="truncate max-w-[260px]">{selectedStage.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {stageNumber}/{String(totalStages).padStart(2, '0')}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[320px]">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">Fases</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {sortedStages.map((stage, i) => {
              const status = getStageStatus(stage)
              const done = stage.tasks_completed
              const total = stage.tasks_total
              return (
                <DropdownMenuItem
                  key={stage.id}
                  onClick={() => handleStageChange(stage.id)}
                  className={cn('flex items-start gap-2 py-2', stage.id === selectedStage.id && 'bg-accent')}
                >
                  <span
                    className={cn(
                      'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      status === 'past' && 'bg-emerald-500/15 text-emerald-700',
                      status === 'current' && 'bg-primary text-primary-foreground',
                      status === 'future' && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{stage.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {status === 'past' ? 'Concluída' : status === 'current' ? 'Em curso' : 'Por iniciar'}
                      {total > 0 && ` · ${done}/${total}`}
                    </div>
                  </div>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {sortedTasks.map((task, i) => {
            const status = getTaskStatus(task)
            const isSelected = task.id === selectedTask.id
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => handleTaskChange(task.id)}
                title={task.title}
                className={cn(
                  'inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2.5 text-[11px] font-semibold tabular-nums transition-all',
                  isSelected
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm dark:bg-white dark:text-neutral-900 dark:border-white'
                    : status === 'past'
                      ? 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
                      : status === 'current'
                        ? 'bg-card text-foreground border-border hover:border-primary/40'
                        : 'bg-card text-foreground border-border hover:border-primary/40',
                )}
                aria-current={isSelected ? 'step' : undefined}
              >
                {String(i + 1).padStart(2, '0')}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Card pair ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        <FocusContextCard
          task={selectedTask}
          status={currentTaskStatus}
          stage={selectedStage}
          className="lg:col-span-2"
        />
        <FocusActionCard
          task={selectedTask}
          status={currentTaskStatus}
          instance={instance}
          property={property}
          owners={owners}
          documents={documents}
          deal={deal}
          onTaskUpdate={onTaskUpdate}
          className="lg:col-span-3"
        />
      </div>
    </div>
  )
}

// ─── Left card: task context ────────────────────────────────────────

function FocusContextCard({
  task,
  status,
  stage,
  className,
}: {
  task: ProcessTask
  status: 'past' | 'current' | 'future'
  stage: ProcessStageWithTasks
  className?: string
}) {
  const assignee = task.assigned_to_user
  const role = task.assigned_role
  const roleColors = role ? getRoleBadgeColors(role) : null
  const priorityConfig = task.priority ? PRIORITY_BADGE_CONFIG[task.priority as keyof typeof PRIORITY_BADGE_CONFIG] : null
  const priorityLabel = task.priority ? TASK_PRIORITY_LABELS[task.priority as keyof typeof TASK_PRIORITY_LABELS] : null
  const statusLabel = TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status

  const statusMeta =
    status === 'past'
      ? {
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          label: task.status === 'skipped' ? 'Dispensada' : 'Concluída',
          tone: 'emerald' as const,
        }
      : status === 'future'
        ? {
            icon: <Lock className="h-3.5 w-3.5" />,
            label: 'Bloqueada',
            tone: 'slate' as const,
          }
        : {
            icon: <PlayCircle className="h-3.5 w-3.5" />,
            label: task.status === 'in_progress' ? 'Em curso' : 'A fazer',
            tone: 'blue' as const,
          }

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm p-5 flex flex-col', className)}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
        {stage.name}
      </div>
      <h3 className="text-lg font-semibold leading-tight">{task.title}</h3>

      {(task.config as any)?.description && (
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {(task.config as any).description}
        </p>
      )}

      {/* Meta chips */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
            statusMeta.tone === 'emerald' && 'bg-emerald-500/15 text-emerald-700',
            statusMeta.tone === 'slate' && 'bg-slate-500/15 text-slate-600',
            statusMeta.tone === 'blue' && 'bg-blue-500/15 text-blue-700',
          )}
        >
          {statusMeta.icon}
          {statusMeta.label}
        </span>
        {priorityConfig && priorityLabel && (
          <Badge variant="outline" className="h-5 text-[10px] font-medium">
            {priorityLabel}
          </Badge>
        )}
        {task.due_date && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDate(task.due_date)}
          </span>
        )}
      </div>

      {/* Responsável — bottom of card */}
      <div className="mt-auto pt-5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
          Responsável
        </div>
        {status === 'past' && (task.completed_at || assignee) ? (
          <div className="text-xs">
            <div className="flex items-center gap-2">
              {assignee && (
                <Avatar className="h-6 w-6">
                  {assignee.profile_photo_url ? (
                    <AvatarImage src={assignee.profile_photo_url} alt={assignee.commercial_name} />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {assignee.commercial_name?.slice(0, 2).toUpperCase() ?? '—'}
                  </AvatarFallback>
                </Avatar>
              )}
              <div>
                <div className="font-medium text-foreground">
                  {assignee?.commercial_name ?? 'Sem responsável'}
                </div>
                {task.completed_at && (
                  <div className="text-muted-foreground">
                    Concluída em {formatDate(task.completed_at)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : assignee ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              {assignee.profile_photo_url ? (
                <AvatarImage src={assignee.profile_photo_url} alt={assignee.commercial_name} />
              ) : null}
              <AvatarFallback className="text-[10px]">
                {assignee.commercial_name?.slice(0, 2).toUpperCase() ?? '—'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-xs font-medium">{assignee.commercial_name}</div>
              {role && roleColors && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] font-medium mt-0.5',
                    roleColors.bg,
                    roleColors.text,
                    roleColors.border,
                  )}
                >
                  {role}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
              <UserRound className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="font-medium text-foreground">Por atribuir</div>
              {role && (
                <div className="text-[10px]">
                  Papel: <span className="font-medium">{role}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Right card: action surface ─────────────────────────────────────

function FocusActionCard({
  task,
  status,
  instance,
  property,
  owners,
  documents,
  deal,
  onTaskUpdate,
  className,
}: {
  task: ProcessTask
  status: 'past' | 'current' | 'future'
  instance: ProcessInstance
  property?: ProcessInstance['property']
  owners?: ProcessOwner[]
  documents?: ProcessDocument[]
  deal?: DealWithRelations
  onTaskUpdate: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 text-white shadow-sm flex flex-col',
        className,
      )}
    >
      {/* Dark header strip */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-white/50 font-medium">
              {status === 'past' ? 'Concluída' : status === 'future' ? 'Bloqueada' : 'A executar'}
            </div>
            <div className="text-sm font-semibold truncate">{task.title}</div>
          </div>
          {task.is_blocked && task.blocking_task_title && (
            <div className="text-[10px] text-white/60 bg-white/10 rounded-full px-2.5 py-1 flex items-center gap-1 whitespace-nowrap">
              <Lock className="h-3 w-3" />
              Aguarda: {task.blocking_task_title}
            </div>
          )}
        </div>
      </div>

      {/* Content on light background so existing subtask cards remain legible */}
      <div className="bg-background flex-1 min-h-0">
        {status === 'future' ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Lock className="h-6 w-6 mx-auto mb-2 opacity-40" />
            Esta tarefa fica disponível quando as tarefas anteriores forem concluídas.
          </div>
        ) : (
          <ScrollArea className="h-full max-h-[70vh]">
            <div className="p-5">
              <TaskDetailActions
                task={task}
                processId={instance.id}
                propertyId={instance.property_id}
                consultantId={instance.requested_by ?? undefined}
                property={property}
                processInstance={instance}
                processDocuments={documents}
                owners={owners}
                deal={deal ?? null}
                onTaskUpdate={onTaskUpdate}
              />
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
