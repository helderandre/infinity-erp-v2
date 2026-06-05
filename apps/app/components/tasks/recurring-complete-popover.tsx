'use client'

import { Check, RotateCcw, Square } from 'lucide-react'
import { ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// Popover Todoist-style mostrado quando o utilizador clica no checkbox
// duma tarefa recorrente. Em vez de concluir directamente (e gerar a
// próxima ocorrência por baixo), pergunta a intenção: concluir só esta
// (mantém recorrência) ou concluir e parar de repetir.
//
// O `children` é o trigger visual — a `<PriorityCheck>` da linha ou do
// detalhe. O Popover usa `asChild` para clonar e forward dos handlers.

interface RecurringCompletePopoverProps {
  children: ReactNode
  onCompleteOnly: () => void
  onCompleteAndStop: () => void
  align?: 'start' | 'center' | 'end'
}

export function RecurringCompletePopover({
  children,
  onCompleteOnly,
  onCompleteAndStop,
  align = 'start',
}: RecurringCompletePopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={cn(
            'w-full flex items-start gap-2.5 text-left px-2.5 py-2 rounded-md',
            'hover:bg-muted transition-colors',
          )}
          onClick={onCompleteOnly}
        >
          <Check className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium leading-tight">Concluir só esta</span>
            <span className="block text-[11px] text-muted-foreground leading-tight mt-0.5">
              A próxima ocorrência continua agendada.
            </span>
          </span>
        </button>
        <button
          type="button"
          className={cn(
            'w-full flex items-start gap-2.5 text-left px-2.5 py-2 rounded-md',
            'hover:bg-muted transition-colors',
          )}
          onClick={onCompleteAndStop}
        >
          <span className="relative h-4 w-4 mt-0.5 shrink-0">
            <Square className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
            <RotateCcw className="absolute inset-0 m-auto h-2.5 w-2.5 text-muted-foreground line-through" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium leading-tight">
              Concluir e parar de repetir
            </span>
            <span className="block text-[11px] text-muted-foreground leading-tight mt-0.5">
              Sem mais ocorrências futuras.
            </span>
          </span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
