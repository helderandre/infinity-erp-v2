'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CheckCircle2, Clock, Lock } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { TASK_PRIORITY_LABELS, getRoleBadgeColors } from '@/lib/constants'
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

type TaskState = 'past' | 'active' | 'future'

interface ProcessFocusViewProps {
  /** The stage whose tasks are being focused on (used for the stage eyebrow). */
  stage: ProcessStageWithTasks | null
  /** All tasks of the selected stage (sorted). Rendered as carousel items. */
  tasks: ProcessTask[]
  /** The currently-focused task id (owned by parent). */
  activeTaskId: string | null
  /** Called when the user selects a different task (via swipe/scroll or click). */
  onTaskChange: (taskId: string) => void
  instance: ProcessInstance
  property?: ProcessInstance['property']
  owners?: ProcessOwner[]
  documents?: ProcessDocument[]
  deal?: DealWithRelations
  onTaskUpdate: () => void
}

function isTaskDone(task: ProcessTask) {
  return task.status === 'completed' || task.status === 'skipped'
}

export function ProcessFocusView({
  stage,
  tasks,
  activeTaskId,
  onTaskChange,
  instance,
  property,
  owners,
  documents,
  deal,
  onTaskUpdate,
}: ProcessFocusViewProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const previousActiveRef = useRef<string | null>(null)

  // When the active task changes externally, scroll its card to the horizontal
  // center of the carousel — WITHOUT touching the page's vertical scroll.
  useEffect(() => {
    if (!activeTaskId || activeTaskId === previousActiveRef.current) {
      previousActiveRef.current = activeTaskId
      return
    }
    const scroller = scrollerRef.current
    const el = cardRefs.current[activeTaskId]
    if (scroller && el) {
      const scrollerRect = scroller.getBoundingClientRect()
      const cardRect = el.getBoundingClientRect()
      // Distance from current scroller center to card center (horizontal only).
      const cardCenter = cardRect.left + cardRect.width / 2
      const scrollerCenter = scrollerRect.left + scrollerRect.width / 2
      const delta = cardCenter - scrollerCenter
      scroller.scrollBy({ left: delta, behavior: 'smooth' })
    }
    previousActiveRef.current = activeTaskId
  }, [activeTaskId])

  // When the user stops scrolling, detect the centered card and sync it up.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || tasks.length === 0) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const scrollerRect = scroller.getBoundingClientRect()
        const centerX = scrollerRect.left + scrollerRect.width / 2
        let closestId: string | null = null
        let closestDistance = Infinity
        for (const task of tasks) {
          const el = cardRefs.current[task.id]
          if (!el) continue
          const rect = el.getBoundingClientRect()
          const cardCenter = rect.left + rect.width / 2
          const distance = Math.abs(cardCenter - centerX)
          if (distance < closestDistance) {
            closestDistance = distance
            closestId = task.id
          }
        }
        if (closestId && closestId !== activeTaskId) {
          onTaskChange(closestId)
        }
      }, 120)
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (timer) clearTimeout(timer)
    }
  }, [tasks, activeTaskId, onTaskChange])

  if (!stage || tasks.length === 0 || !activeTaskId) {
    return (
      <div className="rounded-xl border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        Sem fases ou tarefas disponíveis para apresentar.
      </div>
    )
  }

  const activeIndex = tasks.findIndex((t) => t.id === activeTaskId)

  return (
    <div
      ref={scrollerRef}
      className="relative flex items-start gap-4 overflow-x-auto snap-x snap-proximity scrollbar-hide pb-4"
    >
      {/* Leading spacer so the first card can center while still reserving peek space */}
      <div
        className="shrink-0 w-[8%] sm:w-[22%] md:w-[24%] lg:w-[26%]"
        aria-hidden="true"
      />

      {tasks.map((task, idx) => {
        const state: TaskState =
          idx === activeIndex ? 'active' : isTaskDone(task) ? 'past' : 'future'

        return (
          <div
            key={task.id}
            ref={(el) => {
              cardRefs.current[task.id] = el
            }}
            className="snap-center shrink-0 w-[84%] sm:w-[56%] md:w-[52%] lg:w-[48%] max-w-[680px]"
          >
            <FocusTaskCard
              task={task}
              state={state}
              stage={stage}
              onSelect={() => onTaskChange(task.id)}
              instance={instance}
              property={property}
              owners={owners}
              documents={documents}
              deal={deal}
              onTaskUpdate={onTaskUpdate}
            />
          </div>
        )
      })}

      {/* Trailing spacer so the last card can center */}
      <div
        className="shrink-0 w-[8%] sm:w-[22%] md:w-[24%] lg:w-[26%]"
        aria-hidden="true"
      />
    </div>
  )
}

// ─── Single task card (unified: context + action surface) ───────────

function FocusTaskCard({
  task,
  state,
  stage,
  onSelect,
  instance,
  property,
  owners,
  documents,
  deal,
  onTaskUpdate,
}: {
  task: ProcessTask
  state: TaskState
  stage: ProcessStageWithTasks
  onSelect: () => void
  instance: ProcessInstance
  property?: ProcessInstance['property']
  owners?: ProcessOwner[]
  documents?: ProcessDocument[]
  deal?: DealWithRelations
  onTaskUpdate: () => void
}) {
  const assignee = task.assigned_to_user
  const role = task.assigned_role
  const roleColors = role ? getRoleBadgeColors(role) : null
  const priorityLabel = task.priority ? TASK_PRIORITY_LABELS[task.priority as keyof typeof TASK_PRIORITY_LABELS] : null
  const description = (task.config as any)?.description as string | undefined
  const [addSubtaskSlot, setAddSubtaskSlot] = useState<HTMLDivElement | null>(null)

  // Per-task progress (subtasks completed / total)
  const subtasks = task.subtasks ?? []
  const total = subtasks.length
  const done = subtasks.filter((s: any) => s.is_completed).length
  const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0

  const isActive = state === 'active'
  const isPast = state === 'past'
  const isFuture = state === 'future'

  // Outer wrapper styling varies by state, but the inner structure is identical
  // across all three so non-active cards reserve their TRUE height in the carousel.
  const wrapperClass = cn(
    'relative w-full rounded-2xl shadow-sm flex flex-col transition-all',
    isActive && 'border bg-card p-4 sm:p-6 overflow-hidden',
    isPast && 'border bg-muted/50 p-6 hover:bg-muted cursor-pointer',
    isFuture && 'bg-neutral-900 text-white/70 border border-neutral-800 p-6 hover:bg-neutral-800 cursor-pointer',
  )

  // The real content is wrapped in this container. For non-active states we
  // disable interaction and fade the inner work area while the outer card
  // remains clickable (→ onSelect).
  const contentInteractionClass = isActive
    ? ''
    : 'pointer-events-none select-none'

  return (
    <div
      className={wrapperClass}
      onClick={!isActive ? onSelect : undefined}
      role={!isActive ? 'button' : undefined}
      tabIndex={!isActive ? 0 : undefined}
      onKeyDown={!isActive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } } : undefined}
    >
      {/* Past overlay: emerald checkmark ribbon, top-right */}
      {isPast && (
        <div className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 shadow-sm">
          <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
        </div>
      )}
      {/* Future overlay: lock badge, top-right */}
      {isFuture && (
        <div className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/50">
          <Lock className="h-3.5 w-3.5" />
        </div>
      )}

      <div className={cn('flex flex-col flex-1', contentInteractionClass, isPast && 'opacity-50', isFuture && 'opacity-70')}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
        {stage.name}
      </div>
      <h3 className="text-xl font-semibold leading-tight tracking-tight">{task.title}</h3>

      {/* Progress bar — tight to the title so the title reads as its label */}
      {total > 0 && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-end text-[11px] tabular-nums text-muted-foreground font-medium">
            <span>
              {done}/{total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500 rounded-full',
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-primary',
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Tags row: pills on the left, Adicionar Subtarefa icon slot on the right */}
      <div className="mt-4 flex items-center gap-1.5 flex-wrap">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {priorityLabel && (
            <span className="hidden sm:inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
              {priorityLabel}
            </span>
          )}
          {role && roleColors && (
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                roleColors.bg,
                roleColors.text,
                roleColors.border,
              )}
            >
              {role}
            </span>
          )}
          {task.due_date && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
              <Clock className="h-3 w-3" />
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
        <div ref={setAddSubtaskSlot} className="shrink-0 flex items-center" />
      </div>

      {description && (
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {description}
        </p>
      )}

      {/* Subtasks / action surface — rendered inline as mini glass cards via TaskDetailActions */}
      <div className="task-action-surface mt-5 -mx-4 sm:mx-0 dark text-foreground py-3 px-0 sm:py-0 sm:px-0">
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
          addSubtaskSlot={addSubtaskSlot}
        />
      </div>

      {/* Responsável — only shown when an assignee exists */}
      {assignee && (
        <div className="mt-auto pt-5 flex items-center gap-2 min-w-0">
          <Avatar className="h-7 w-7 shrink-0">
            {assignee.profile_photo_url ? (
              <AvatarImage src={assignee.profile_photo_url} alt={assignee.commercial_name} />
            ) : null}
            <AvatarFallback className="text-[10px]">
              {assignee.commercial_name?.slice(0, 2).toUpperCase() ?? '—'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{assignee.commercial_name}</div>
            <div className="text-[10px] text-muted-foreground">
              {task.status === 'completed' && task.completed_at
                ? `Concluída em ${formatDate(task.completed_at)}`
                : 'Responsável'}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
