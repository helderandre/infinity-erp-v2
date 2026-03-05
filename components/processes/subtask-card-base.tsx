'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Circle, CheckCircle2, FileEdit } from 'lucide-react'
import type { ProcSubtask } from '@/types/subtask'

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
  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2 transition-colors',
        CARD_STATES[state].bg,
        state === 'completed' && 'opacity-80',
        className,
      )}
    >
      {/* Header: ícone + título + status badge */}
      <div className="flex items-center gap-2">
        <div className="shrink-0">{icon}</div>
        <span className={cn(
          'flex-1 text-sm font-medium',
          state === 'completed' && 'line-through text-muted-foreground'
        )}>
          {subtask.title}
        </span>
        {!subtask.is_mandatory && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Opcional</Badge>
        )}
      </div>

      {/* Conteúdo específico do tipo */}
      {children}

      {/* Footer: owner badge + type label */}
      {(subtask.owner || footer) && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
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
