'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Ban,
  Building2,
  Calendar,
  CheckCircle2,
  CheckCircle,
  Circle,
  ChevronDown,
  Lock,
  MoreHorizontal,
  PlayCircle,
  Trash2,
  User,
  UserPlus,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { getRoleBadgeColors } from '@/lib/constants'
import { TaskDetailActions } from './task-detail-actions'
import type {
  ProcessDocument,
  ProcessInstance,
  ProcessOwner,
  ProcessStageWithTasks,
  ProcessTask,
} from '@/types/process'
import type { Deal, DealClient, DealPayment } from '@/types/deal'

type DealWithRelations =
  | (Deal & { deal_clients?: DealClient[]; deal_payments?: DealPayment[] })
  | null

interface ProcessStageMobileViewProps {
  stages: ProcessStageWithTasks[]
  instance: ProcessInstance
  property?: ProcessInstance['property']
  owners?: ProcessOwner[]
  documents?: ProcessDocument[]
  deal?: DealWithRelations
  isProcessing: boolean
  canDeleteAdhoc?: boolean
  onTaskAction: (taskId: string, action: string) => void
  onTaskBypass: (task: ProcessTask) => void
  onTaskAssign: (task: ProcessTask) => void
  onTaskDelete?: (task: ProcessTask) => void
  onStageComplete?: (stageId: string) => void
  onTaskUpdate: () => void
}

function isTaskDone(task: ProcessTask) {
  return task.status === 'completed' || task.status === 'skipped'
}

/**
 * Mobile/tablet view of the process pipeline. One stage at a time via a centered
 * pill selector at the top. Inside the stage, tasks split into Pendentes (with
 * the current task auto-expanded; siblings collapsed but tappable to expand)
 * and Concluídos (collapsed accordion at the bottom). Bypassed tasks are
 * hidden entirely. Open/closed state of individual tasks does not persist
 * across remount.
 */
export function ProcessStageMobileView({
  stages,
  instance,
  property,
  owners = [],
  documents = [],
  deal,
  isProcessing,
  canDeleteAdhoc,
  onTaskAction,
  onTaskBypass,
  onTaskAssign,
  onTaskDelete,
  onStageComplete,
  onTaskUpdate,
}: ProcessStageMobileViewProps) {
  // ── Pick initial stage: current → first non-fully-completed → first
  const initialStageId = useMemo(() => {
    if (stages.length === 0) return null
    const current = stages.find((s) => s.is_current && !s.is_completed_explicit)
    if (current) return current.id
    const firstOpen = stages.find(
      (s) => !s.is_completed_explicit && s.tasks_completed < s.tasks_total,
    )
    if (firstOpen) return firstOpen.id
    return stages[0]!.id
  }, [stages])

  const [pickedStageId, setPickedStageId] = useState<string | null>(null)

  // Derive effective stage id: user pick if still valid, else fall back.
  const selectedStageId =
    pickedStageId && stages.some((s) => s.id === pickedStageId)
      ? pickedStageId
      : initialStageId

  // Scroll the active pill into view whenever the effective stage changes.
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  useEffect(() => {
    if (!selectedStageId) return
    const el = pillRefs.current[selectedStageId]
    if (!el) return
    el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [selectedStageId])

  const stage = stages.find((s) => s.id === selectedStageId) ?? null

  // Hide bypassed tasks; split visible tasks into pendentes / concluídos.
  const visibleTasks = (stage?.tasks ?? []).filter((t) => !t.is_bypassed)
  const pendentes = visibleTasks.filter((t) => !isTaskDone(t))
  const concluidos = visibleTasks.filter(isTaskDone)

  // First non-completed task is the auto-expanded "current" task.
  const currentTaskId = pendentes[0]?.id ?? null

  // Open/close state is keyed by stage so revisiting a stage restores the
  // "current task expanded, others collapsed" default without an effect-reset.
  const [taskOpenByStage, setTaskOpenByStage] = useState<Record<string, Record<string, boolean>>>({})
  const [concluidosOpenByStage, setConcluidosOpenByStage] = useState<Record<string, boolean>>({})

  const taskOpenState: Record<string, boolean> =
    (selectedStageId ? taskOpenByStage[selectedStageId] : undefined) ?? {}
  const concluidosOpen = !!(selectedStageId && concluidosOpenByStage[selectedStageId])

  function isTaskExpanded(task: ProcessTask) {
    const explicit = taskOpenState[task.id]
    if (typeof explicit === 'boolean') return explicit
    return task.id === currentTaskId
  }

  function toggleTask(taskId: string) {
    if (!selectedStageId) return
    setTaskOpenByStage((prev) => {
      const stageMap = prev[selectedStageId] ?? {}
      const explicit = stageMap[taskId]
      const isCurrent = taskId === currentTaskId
      const currentlyOpen = typeof explicit === 'boolean' ? explicit : isCurrent
      return {
        ...prev,
        [selectedStageId]: { ...stageMap, [taskId]: !currentlyOpen },
      }
    })
  }

  function setConcluidosOpen(open: boolean) {
    if (!selectedStageId) return
    setConcluidosOpenByStage((prev) => ({ ...prev, [selectedStageId]: open }))
  }

  if (!stage) {
    return (
      <div className="rounded-xl border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        Sem fases disponíveis.
      </div>
    )
  }

  const stageProgress =
    stage.tasks_total > 0
      ? Math.round((stage.tasks_completed / stage.tasks_total) * 100)
      : 0

  return (
    <div className="space-y-4">
      {/* ── Stage pill selector ── */}
      <div className="-mx-4 sm:mx-0">
        <div
          className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 sm:px-0 snap-x snap-proximity"
        >
          {stages.map((s) => {
            const isActive = s.id === selectedStageId
            const isDone = s.is_completed_explicit
            const isCurrent = s.is_current && !isDone
            return (
              <button
                key={s.id}
                ref={(el) => {
                  pillRefs.current[s.id] = el
                }}
                onClick={() => setPickedStageId(s.id)}
                className={cn(
                  'shrink-0 snap-center inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                  isActive
                    ? 'bg-foreground text-background border-foreground shadow-sm'
                    : isDone
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
                      : isCurrent
                        ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30'
                        : 'bg-card text-muted-foreground border-border hover:bg-accent',
                )}
                aria-pressed={isActive}
              >
                {isDone ? (
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full shrink-0',
                      isActive
                        ? 'bg-background'
                        : isCurrent
                          ? 'bg-blue-500'
                          : 'bg-slate-400',
                    )}
                  />
                )}
                <span className="truncate max-w-[140px]">{s.name}</span>
                <span
                  className={cn(
                    'tabular-nums text-[10px]',
                    isActive ? 'text-background/80' : 'text-muted-foreground',
                  )}
                >
                  {s.tasks_completed}/{s.tasks_total}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Stage progress + complete CTA ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-500 rounded-full',
              stageProgress === 100 ? 'bg-emerald-500' : 'bg-primary',
            )}
            style={{ width: `${stageProgress}%` }}
          />
        </div>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {stageProgress}%
        </span>
      </div>
      {stage.is_current && !stage.is_completed_explicit && onStageComplete && stage.tasks_completed === stage.tasks_total && stage.tasks_total > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onStageComplete(stage.id)}
          disabled={isProcessing}
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          Concluir Estágio
        </Button>
      )}

      {/* ── Pendentes ── */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-2 px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pendentes
          </h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {pendentes.length}
          </span>
        </div>
        {pendentes.length === 0 ? (
          <div className="rounded-xl border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
            Nenhuma tarefa pendente nesta fase.
          </div>
        ) : (
          <div className="space-y-2">
            {pendentes.map((task) => (
              <MobileTaskAccordion
                key={task.id}
                task={task}
                expanded={isTaskExpanded(task)}
                isCurrent={task.id === currentTaskId}
                isProcessing={isProcessing}
                canDeleteAdhoc={canDeleteAdhoc}
                instance={instance}
                property={property}
                owners={owners}
                documents={documents}
                deal={deal}
                onToggle={() => toggleTask(task.id)}
                onAction={onTaskAction}
                onAssign={onTaskAssign}
                onBypass={onTaskBypass}
                onDelete={onTaskDelete}
                onTaskUpdate={onTaskUpdate}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Concluídos (collapsed by default) ── */}
      {concluidos.length > 0 && (
        <Collapsible open={concluidosOpen} onOpenChange={setConcluidosOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-left hover:bg-muted/60 transition-colors">
              <div className="flex items-baseline gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Concluídos
                </h3>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {concluidos.length}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  concluidosOpen && 'rotate-180',
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {concluidos.map((task) => (
              <MobileTaskAccordion
                key={task.id}
                task={task}
                expanded={isTaskExpanded(task)}
                isCurrent={false}
                isProcessing={isProcessing}
                canDeleteAdhoc={canDeleteAdhoc}
                instance={instance}
                property={property}
                owners={owners}
                documents={documents}
                deal={deal}
                onToggle={() => toggleTask(task.id)}
                onAction={onTaskAction}
                onAssign={onTaskAssign}
                onBypass={onTaskBypass}
                onDelete={onTaskDelete}
                onTaskUpdate={onTaskUpdate}
                muted
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Single task accordion: header (always visible) + body (expanded only).
// ──────────────────────────────────────────────────────────────────────

interface MobileTaskAccordionProps {
  task: ProcessTask
  expanded: boolean
  isCurrent: boolean
  isProcessing: boolean
  canDeleteAdhoc?: boolean
  instance: ProcessInstance
  property?: ProcessInstance['property']
  owners?: ProcessOwner[]
  documents?: ProcessDocument[]
  deal?: DealWithRelations
  /** Render the header in a faded, completed-style. */
  muted?: boolean
  onToggle: () => void
  onAction: (taskId: string, action: string) => void
  onAssign: (task: ProcessTask) => void
  onBypass: (task: ProcessTask) => void
  onDelete?: (task: ProcessTask) => void
  onTaskUpdate: () => void
}

function MobileTaskAccordion({
  task,
  expanded,
  isCurrent,
  isProcessing,
  canDeleteAdhoc,
  instance,
  property,
  owners,
  documents,
  deal,
  muted,
  onToggle,
  onAction,
  onAssign,
  onBypass,
  onDelete,
  onTaskUpdate,
}: MobileTaskAccordionProps) {
  const isAdhoc = !task.tpl_task_id
  const isBlocked = !!task.is_blocked
  const isDone = isTaskDone(task)
  const subtasks = task.subtasks ?? []
  const subtaskTotal = subtasks.length
  const subtaskDone = subtasks.filter((s) => s.is_completed).length
  const subtaskPct =
    subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : 0

  const now = new Date()
  const dueDate = task.due_date ? new Date(task.due_date) : null
  const msLeft = dueDate ? dueDate.getTime() - now.getTime() : null
  const isOverdue = dueDate && msLeft !== null && msLeft < 0 && !isDone
  const isUrgent =
    dueDate && msLeft !== null && msLeft >= 0 && msLeft < 24 * 60 * 60 * 1000 && !isDone
  const isWarning =
    dueDate &&
    msLeft !== null &&
    msLeft >= 24 * 60 * 60 * 1000 &&
    msLeft < 72 * 60 * 60 * 1000 &&
    !isDone

  // PROC-NEG client context
  const taskConfig = task.config as Record<string, unknown> | null
  const clientName = taskConfig?.client_name as string | undefined
  const clientPersonType = taskConfig?.person_type_filter as
    | 'singular'
    | 'coletiva'
    | undefined
  const ClientIcon = clientPersonType === 'coletiva' ? Building2 : User

  const statusIcon = isBlocked ? (
    <Lock className="h-4 w-4 text-primary" />
  ) : task.status === 'completed' ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  ) : task.status === 'skipped' ? (
    <Ban className="h-4 w-4 text-orange-500" />
  ) : task.status === 'in_progress' ? (
    <PlayCircle className="h-4 w-4 text-blue-500" />
  ) : (
    <Circle className="h-4 w-4 text-muted-foreground" />
  )

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-all',
        expanded && 'shadow-sm',
        isCurrent && !expanded && 'ring-1 ring-primary/30',
        isOverdue && 'border-red-500/40',
        isBlocked && 'opacity-70 border-dashed',
        muted && 'opacity-70',
      )}
    >
      {/* ── Header ── */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-2.5 p-3 text-left"
      >
        <div className="shrink-0 mt-0.5">{statusIcon}</div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-2">
            <span
              className={cn(
                'flex-1 text-sm font-medium leading-snug',
                isDone && 'line-through text-muted-foreground',
              )}
            >
              {task.title}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform shrink-0 mt-0.5',
                expanded && 'rotate-180',
              )}
            />
          </div>

          {/* Meta chips row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.assigned_role && (() => {
              const rc = getRoleBadgeColors(task.assigned_role)
              return (
                <span
                  className={cn(
                    'text-[10px] font-medium px-1.5 py-0 rounded-full border',
                    rc.bg,
                    rc.text,
                    rc.border,
                  )}
                >
                  {task.assigned_role}
                </span>
              )
            })()}
            {clientName && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-sky-500/30 text-sky-700 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30 gap-1"
              >
                <ClientIcon className="h-2.5 w-2.5" />
                <span className="truncate max-w-[100px]">{clientName}</span>
              </Badge>
            )}
            {isBlocked && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/5"
              >
                <Lock className="h-2.5 w-2.5 mr-0.5" />
                Bloqueada
              </Badge>
            )}
            {dueDate && !isDone && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]',
                  (isOverdue || isUrgent) && 'bg-red-500/10 text-red-600 font-medium',
                  isWarning && 'bg-amber-400/10 text-amber-600 font-medium',
                  !isOverdue && !isUrgent && !isWarning && 'text-muted-foreground',
                )}
              >
                <Calendar className="h-3 w-3" />
                {formatDate(task.due_date!)}
              </span>
            )}
            {task.assigned_to_user && (
              <Avatar size="sm" className="size-5 ml-auto" title={task.assigned_to_user.commercial_name}>
                {task.assigned_to_user.profile_photo_url && (
                  <AvatarImage
                    src={task.assigned_to_user.profile_photo_url}
                    alt={task.assigned_to_user.commercial_name}
                  />
                )}
                <AvatarFallback className="text-[9px]">
                  {task.assigned_to_user.commercial_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* Subtask progress (only when collapsed and has subtasks) */}
          {!expanded && subtaskTotal > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    subtaskPct === 100 ? 'bg-emerald-500' : 'bg-primary',
                  )}
                  style={{ width: `${subtaskPct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {subtaskDone}/{subtaskTotal}
              </span>
            </div>
          )}

          {/* Bypass reason (only if visible — bypassed tasks are filtered out, so this is a no-op currently) */}
          {task.is_bypassed && task.bypass_reason && (
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              Dispensada: {task.bypass_reason}
            </p>
          )}
        </div>
      </button>

      {/* ── Action menu (positioned absolutely so the whole card can be tappable) ── */}
      <div
        className="absolute"
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* ── Body ── */}
      {expanded && (
        <div className="border-t bg-card/40 px-3 pb-3 pt-3 space-y-3">
          {/* Quick actions: assign / dispense / delete (kept compact) */}
          {!isDone && (
            <div className="flex items-center gap-1.5 -mt-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    disabled={isProcessing}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5 mr-1" />
                    Mais
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {!isBlocked && (
                    <DropdownMenuItem onClick={() => onAssign(task)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Atribuir
                    </DropdownMenuItem>
                  )}
                  {!isBlocked && !task.is_mandatory && (
                    <DropdownMenuItem onClick={() => onBypass(task)}>
                      <Ban className="mr-2 h-4 w-4" />
                      Dispensar
                    </DropdownMenuItem>
                  )}
                  {isAdhoc && canDeleteAdhoc && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete?.(task)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remover tarefa
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Reactivate (skipped → pending) */}
          {task.status === 'skipped' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onAction(task.id, 'reset')}
              disabled={isProcessing}
            >
              <Circle className="mr-2 h-4 w-4" />
              Reactivar
            </Button>
          )}

          {/* Action surface: subtasks + state buttons (start/complete/dispense). */}
          <TaskDetailActions
            task={task}
            processId={instance.id}
            propertyId={instance.property_id ?? ''}
            consultantId={instance.requested_by ?? undefined}
            property={property}
            processInstance={instance}
            processDocuments={documents}
            owners={owners}
            deal={deal ?? null}
            onTaskUpdate={onTaskUpdate}
          />
        </div>
      )}
    </div>
  )
}
