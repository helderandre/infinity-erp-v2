'use client'

import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { PRIORITY_BADGE_CONFIG, TASK_PRIORITY_LABELS } from '@/lib/constants'
import { Circle, CheckCircle2, FileEdit, Lock, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { ProcSubtask } from '@/types/subtask'

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// Estado visual do card
const CARD_STATES = {
  pending: {
    bg: 'bg-card',
    icon: Circle,
  },
  draft: {
    bg: 'bg-card',
    icon: FileEdit,
  },
  completed: {
    bg: 'bg-muted/50',
    icon: CheckCircle2,
  },
} as const

type CardState = keyof typeof CARD_STATES

interface SubtaskCardBaseProps {
  subtask: ProcSubtask
  state: CardState
  icon: React.ReactNode
  typeLabel: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function SubtaskCardBase({
  subtask, state, icon, typeLabel, children, footer, className,
}: SubtaskCardBaseProps) {
  const isBlocked = !!subtask.is_blocked

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2 transition-colors',
        CARD_STATES[state].bg,
        state === 'completed' && 'opacity-80',
        isBlocked && 'opacity-60 border-dashed',
        className,
      )}
    >
      {/* Header: ícone + título + status badge */}
      <div className="flex items-center gap-2">
        {isBlocked ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="shrink-0">
                  <Lock className="h-4 w-4 text-amber-500" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Bloqueada — aguarda conclusão de dependência</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="shrink-0">{icon}</div>
        )}
        <span className={cn(
          'flex-1 text-sm font-medium',
          state === 'completed' && 'line-through text-muted-foreground'
        )}>
          {subtask.title}
        </span>
        {isBlocked && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600 bg-amber-50">
            <Lock className="h-2.5 w-2.5 mr-0.5" />
            Bloqueada
          </Badge>
        )}
        {subtask.priority && subtask.priority !== 'normal' && (
          <Badge
            variant="outline"
            className={cn('text-[10px] gap-1 px-1.5 py-0 shrink-0', PRIORITY_BADGE_CONFIG[subtask.priority]?.className)}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_BADGE_CONFIG[subtask.priority]?.dotColor)} />
            {TASK_PRIORITY_LABELS[subtask.priority as keyof typeof TASK_PRIORITY_LABELS]}
          </Badge>
        )}
        {subtask.due_date && !subtask.is_completed && (
          <Badge
            variant={isOverdue(subtask.due_date) ? 'destructive' : 'outline'}
            className="text-[10px] px-1.5 py-0 shrink-0"
          >
            <Calendar className="h-2.5 w-2.5 mr-0.5" />
            {format(new Date(subtask.due_date), 'dd/MM', { locale: pt })}
          </Badge>
        )}
        {subtask.assigned_to_user && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarFallback className="text-[8px]">
                    {getInitials(subtask.assigned_to_user.commercial_name)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="top"><p>{subtask.assigned_to_user.commercial_name}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {!subtask.is_mandatory && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Opcional</Badge>
        )}
      </div>

      {/* Conteúdo específico do tipo */}
      {children}

      {/* Footer: owner badge + role badge + type label */}
      {(subtask.owner || subtask.assigned_role || footer) && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/50 flex-wrap">
          {subtask.owner && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0',
                subtask.owner.person_type === 'singular'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-purple-50 text-purple-700 border-purple-200'
              )}
            >
              {subtask.owner.person_type === 'singular' ? '👤' : '🏢'} {subtask.owner.name}
            </Badge>
          )}
          {subtask.assigned_role && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-200">
              {subtask.assigned_role}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">
            {typeLabel}
          </Badge>
          {footer}
        </div>
      )}
    </div>
  )
}

export { CARD_STATES, type CardState }
