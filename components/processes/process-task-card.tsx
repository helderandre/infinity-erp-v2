'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  Ban,
  MoreHorizontal,
  UserPlus,
  Calendar,
  Upload,
  Mail,
  FileText,
  User,
  Building2,
  ClipboardList,
  Layers,
  CheckSquare,
  Lock,
  FormInput,
  TextCursorInput,
  CalendarPlus,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ACTION_TYPE_LABELS, TASK_PRIORITY_LABELS, PRIORITY_BADGE_CONFIG } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { ProcessTask, TaskPriority } from '@/types/process'
import type { ProcSubtask } from '@/types/subtask'

// Mini progress bar for kanban cards
function SubtaskProgressBar({ subtasks }: { subtasks: ProcSubtask[] }) {
  const done = subtasks.filter((s) => s.is_completed).length
  const total = subtasks.length
  const pct = Math.round((done / total) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-emerald-500' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
        {done}/{total}
      </span>
    </div>
  )
}

// Compact badge for list variant
function SubtaskProgressBadge({ subtasks }: { subtasks: ProcSubtask[] }) {
  const done = subtasks.filter((s) => s.is_completed).length
  const total = subtasks.length
  const pct = Math.round((done / total) * 100)
  return (
    <Badge variant="outline" className="text-[10px] gap-1.5 px-1.5 py-0 shrink-0 tabular-nums">
      <div className="h-1 w-8 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {done}/{total}
    </Badge>
  )
}

const STATUS_ICONS = {
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  in_progress: <PlayCircle className="h-4 w-4 text-blue-500" />,
  skipped: <Ban className="h-4 w-4 text-orange-500" />,
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
}

const ACTION_ICONS = {
  UPLOAD: <Upload className="h-3.5 w-3.5" />,
  EMAIL: <Mail className="h-3.5 w-3.5" />,
  GENERATE_DOC: <FileText className="h-3.5 w-3.5" />,
  MANUAL: <Circle className="h-3.5 w-3.5" />,
  FORM: <ClipboardList className="h-3.5 w-3.5" />,
  COMPOSITE: <Layers className="h-3.5 w-3.5" />,
}

const SUBTASK_TYPE_ICONS_MAP: Record<string, React.ReactNode> = {
  upload: <Upload className="h-3 w-3" />,
  checklist: <CheckSquare className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
  generate_doc: <FileText className="h-3 w-3" />,
  form: <FormInput className="h-3 w-3" />,
  field: <TextCursorInput className="h-3 w-3" />,
  schedule_event: <CalendarPlus className="h-3 w-3" />,
  external_form: <ClipboardList className="h-3 w-3" />,
}


interface ProcessTaskCardProps {
  task: ProcessTask
  variant: 'kanban' | 'list'
  isProcessing: boolean
  canDeleteAdhoc?: boolean
  onAction: (taskId: string, action: string) => void
  onBypass: (task: ProcessTask) => void
  onAssign: (task: ProcessTask) => void
  onClick?: (task: ProcessTask) => void
  onDelete?: (task: ProcessTask) => void
}

export function ProcessTaskCard({
  task,
  variant,
  isProcessing,
  canDeleteAdhoc,
  onAction,
  onBypass,
  onAssign,
  onClick,
  onDelete,
}: ProcessTaskCardProps) {
  const isAdhoc = !task.tpl_task_id
  const isBlocked = !!task.is_blocked
  const isNotDone = !['completed', 'skipped'].includes(task.status ?? '')
  const now = new Date()
  const dueDate = task.due_date ? new Date(task.due_date) : null
  const msLeft = dueDate ? dueDate.getTime() - now.getTime() : null
  const isOverdue = dueDate && msLeft !== null && msLeft < 0 && isNotDone
  const isUrgent = dueDate && msLeft !== null && msLeft >= 0 && msLeft < 24 * 60 * 60 * 1000 && isNotDone
  const isWarning = dueDate && msLeft !== null && msLeft >= 24 * 60 * 60 * 1000 && msLeft < 72 * 60 * 60 * 1000 && isNotDone
  const statusIcon = isBlocked
    ? <Lock className="h-4 w-4 text-primary" />
    : (STATUS_ICONS[task.status as keyof typeof STATUS_ICONS] ?? STATUS_ICONS.pending)
  const actionIcon = ACTION_ICONS[task.action_type as keyof typeof ACTION_ICONS] ?? ACTION_ICONS.MANUAL
  const actionMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={isProcessing}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isBlocked && (
          <DropdownMenuItem disabled className="text-primary">
            <Lock className="mr-2 h-4 w-4" />
            Bloqueada — aguarda dependência
          </DropdownMenuItem>
        )}
        {!isBlocked && task.status === 'pending' && (
          <DropdownMenuItem onClick={() => onAction(task.id, 'start')}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Iniciar
          </DropdownMenuItem>
        )}
        {!isBlocked && ['pending', 'in_progress'].includes(task.status ?? '') && (
          <>
            <DropdownMenuItem onClick={() => onAction(task.id, 'complete')}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Concluir
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAssign(task)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Atribuir
            </DropdownMenuItem>
            {!task.is_mandatory && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onBypass(task)}>
                  <Ban className="mr-2 h-4 w-4" />
                  Dispensar
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
        {task.status === 'skipped' && (
          <DropdownMenuItem onClick={() => onAction(task.id, 'reset')}>
            <Circle className="mr-2 h-4 w-4" />
            Reactivar
          </DropdownMenuItem>
        )}
        {isAdhoc && canDeleteAdhoc && !['completed'].includes(task.status ?? '') && (
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
  )

  if (variant === 'kanban') {
    return (
      <div
        className={cn(
          'rounded-lg border bg-card p-3 space-y-2 hover:shadow-sm transition-shadow cursor-pointer',
          task.status === 'completed' && 'shadow-[0_0_8px_0_rgba(16,185,129,0.15)] border-emerald-500/30',
          isOverdue && 'border-red-500/40',
          isBlocked && 'opacity-60 border-dashed'
        )}
        onClick={() => onClick?.(task)}
      >
        {/* Row 1: status icon + title + action menu */}
        <div className="flex items-start gap-2">
          <div className="shrink-0 mt-0.5">{statusIcon}</div>
          <span className="flex-1 text-sm font-medium leading-snug line-clamp-2">{task.title}</span>
          {isBlocked && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/5 shrink-0">
              <Lock className="h-2.5 w-2.5 mr-0.5" />
              Bloqueada
            </Badge>
          )}
          <div onClick={(e) => e.stopPropagation()}>
            {actionMenu}
          </div>
        </div>

        {/* Owner */}
        {task.owner && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            {task.owner.person_type === 'coletiva' ? (
              <Building2 className="h-3 w-3" />
            ) : (
              <User className="h-3 w-3" />
            )}
            <span className="truncate max-w-[80px]">{task.owner.name}</span>
          </span>
        )}

        {/* Subtask progress bar */}
        {task.subtasks && task.subtasks.length > 0 && (
          <SubtaskProgressBar subtasks={task.subtasks} />
        )}

        {/* Row 3: due date + assignee */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          {task.due_date && isNotDone ? (
            <span className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]',
              (isOverdue || isUrgent) && 'bg-red-500/10 text-red-600 font-medium',
              isWarning && 'bg-amber-400/10 text-amber-600 font-medium',
              !isOverdue && !isUrgent && !isWarning && 'text-muted-foreground',
            )}>
              <Calendar className="h-3 w-3" />
              {formatDate(task.due_date)}
            </span>
          ) : (
            <span />
          )}
          {task.assigned_to_user && (
            <span className="flex items-center gap-1.5 truncate max-w-[140px]">
              <Avatar size="sm">
                {task.assigned_to_user.profile_photo_url && (
                  <AvatarImage src={task.assigned_to_user.profile_photo_url} alt={task.assigned_to_user.commercial_name} />
                )}
                <AvatarFallback>
                  {task.assigned_to_user.commercial_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{task.assigned_to_user.commercial_name}</span>
            </span>
          )}
        </div>

        {/* Bypass reason */}
        {task.is_bypassed && task.bypass_reason && (
          <p className="text-[11px] text-muted-foreground line-clamp-1">
            Dispensada: {task.bypass_reason}
          </p>
        )}
      </div>
    )
  }

  // variant === 'list'
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer',
        isOverdue && 'border-red-500/40',
        isBlocked && 'opacity-60 border-dashed'
      )}
      onClick={() => onClick?.(task)}
    >
      <div className="shrink-0">{statusIcon}</div>

      {/* Action type icon */}
      <div className="shrink-0 text-muted-foreground">{actionIcon}</div>

      {/* Title */}
      <span className="flex-1 text-sm font-medium truncate">{task.title}</span>

      {/* Blocked badge */}
      {isBlocked && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/5 shrink-0">
          <Lock className="h-2.5 w-2.5 mr-0.5" />
          Bloqueada
        </Badge>
      )}

      {/* Owner */}
      {task.owner && (
        <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
          {task.owner.person_type === 'coletiva' ? (
            <Building2 className="h-3 w-3" />
          ) : (
            <User className="h-3 w-3" />
          )}
          <span className="truncate max-w-[80px]">{task.owner.name}</span>
        </span>
      )}

      {/* Subtask progress (list variant) */}
      {task.subtasks && task.subtasks.length > 0 && (
        <SubtaskProgressBadge subtasks={task.subtasks} />
      )}

      {/* Due date */}
      {task.due_date && isNotDone && (
        <span className={cn(
          'shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]',
          (isOverdue || isUrgent) && 'bg-red-500/10 text-red-600 font-medium',
          isWarning && 'bg-amber-400/10 text-amber-600 font-medium',
          !isOverdue && !isUrgent && !isWarning && 'text-muted-foreground',
        )}>
          <Calendar className="h-3 w-3" />
          {formatDate(task.due_date)}
        </span>
      )}

      {/* Assignee */}
      {task.assigned_to_user && (
        <span className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground truncate max-w-[140px]">
          <Avatar size="sm">
            {task.assigned_to_user.profile_photo_url && (
              <AvatarImage src={task.assigned_to_user.profile_photo_url} alt={task.assigned_to_user.commercial_name} />
            )}
            <AvatarFallback>
              {task.assigned_to_user.commercial_name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{task.assigned_to_user.commercial_name}</span>
        </span>
      )}

      {/* Action menu */}
      <div onClick={(e) => e.stopPropagation()}>
        {actionMenu}
      </div>
    </div>
  )
}
