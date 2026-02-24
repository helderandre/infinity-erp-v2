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
  Flag,
  Calendar,
  Upload,
  Mail,
  FileText,
  User,
  Building2,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ACTION_TYPE_LABELS, TASK_PRIORITY_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { ProcessTask, TaskPriority } from '@/types/process'

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
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: 'text-red-500',
  normal: 'text-amber-500',
  low: 'text-slate-400',
}

interface ProcessTaskCardProps {
  task: ProcessTask
  variant: 'kanban' | 'list'
  isProcessing: boolean
  onAction: (taskId: string, action: string) => void
  onBypass: (task: ProcessTask) => void
  onAssign: (task: ProcessTask) => void
  onClick?: (task: ProcessTask) => void
}

export function ProcessTaskCard({
  task,
  variant,
  isProcessing,
  onAction,
  onBypass,
  onAssign,
  onClick,
}: ProcessTaskCardProps) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !['completed', 'skipped'].includes(task.status ?? '')
  const statusIcon = STATUS_ICONS[task.status as keyof typeof STATUS_ICONS] ?? STATUS_ICONS.pending
  const actionIcon = ACTION_ICONS[task.action_type as keyof typeof ACTION_ICONS] ?? ACTION_ICONS.MANUAL
  const priorityColor = PRIORITY_COLORS[(task.priority as TaskPriority) ?? 'normal']

  const actionMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={isProcessing}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {task.status === 'pending' && (
          <DropdownMenuItem onClick={() => onAction(task.id, 'start')}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Iniciar
          </DropdownMenuItem>
        )}
        {['pending', 'in_progress'].includes(task.status ?? '') && (
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
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (variant === 'kanban') {
    return (
      <div
        className={cn(
          'rounded-lg border bg-card p-3 space-y-2 hover:shadow-sm transition-shadow cursor-pointer',
          isOverdue && 'border-red-500/40'
        )}
        onClick={() => onClick?.(task)}
      >
        {/* Row 1: status icon + title + action menu */}
        <div className="flex items-start gap-2">
          <div className="shrink-0 mt-0.5">{statusIcon}</div>
          <span className="flex-1 text-sm font-medium leading-snug line-clamp-2">{task.title}</span>
          <div onClick={(e) => e.stopPropagation()}>
            {actionMenu}
          </div>
        </div>

        {/* Row 2: badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Action type */}
          <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
            {actionIcon}
            {ACTION_TYPE_LABELS[task.action_type as keyof typeof ACTION_TYPE_LABELS] ?? task.action_type}
          </Badge>

          {/* Priority flag */}
          {task.priority && task.priority !== 'normal' && (
            <Flag className={cn('h-3.5 w-3.5', priorityColor)} />
          )}

          {/* Mandatory */}
          {task.is_mandatory && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Obrig.
            </Badge>
          )}

          {/* Owner */}
          {task.owner && (
            <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
              {task.owner.person_type === 'coletiva' ? (
                <Building2 className="h-3 w-3" />
              ) : (
                <User className="h-3 w-3" />
              )}
              <span className="truncate max-w-[80px]">{task.owner.name}</span>
            </Badge>
          )}

          {/* Subtask count for FORM */}
          {task.action_type === 'FORM' && task.subtasks && task.subtasks.length > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {task.subtasks.filter((s) => s.is_completed).length}/{task.subtasks.length}
            </span>
          )}
        </div>

        {/* Row 3: due date + assignee */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          {task.due_date ? (
            <span className={cn('flex items-center gap-1', isOverdue && 'text-red-500 font-medium')}>
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
        isOverdue && 'border-red-500/40'
      )}
      onClick={() => onClick?.(task)}
    >
      <div className="shrink-0">{statusIcon}</div>

      {/* Action type icon */}
      <div className="shrink-0 text-muted-foreground">{actionIcon}</div>

      {/* Title */}
      <span className="flex-1 text-sm font-medium truncate">{task.title}</span>

      {/* Priority flag */}
      {task.priority && task.priority !== 'normal' && (
        <Flag className={cn('h-3.5 w-3.5 shrink-0', priorityColor)} />
      )}

      {/* Mandatory */}
      {task.is_mandatory && (
        <Badge variant="secondary" className="text-[10px] shrink-0">
          Obrig.
        </Badge>
      )}

      {/* Owner */}
      {task.owner && (
        <Badge variant="outline" className="text-xs gap-1 shrink-0">
          {task.owner.person_type === 'coletiva' ? (
            <Building2 className="h-3 w-3" />
          ) : (
            <User className="h-3 w-3" />
          )}
          <span className="truncate max-w-[80px]">{task.owner.name}</span>
        </Badge>
      )}

      {/* Due date */}
      {task.due_date && (
        <span className={cn('text-xs shrink-0 flex items-center gap-1', isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
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
