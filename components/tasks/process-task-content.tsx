'use client'

import Link from 'next/link'
import { format, isPast, isToday } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  CalendarDays, Building2, Workflow, X,
  Handshake, ArrowRight,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { TASK_PRIORITY_MAP } from '@/types/task'
import type { TaskWithRelations } from '@/types/task'

interface ProcessTaskContentProps {
  task: TaskWithRelations
  variant?: 'sheet' | 'inline'
  onClose?: () => void
}

export function ProcessTaskContent({ task, variant = 'sheet', onClose }: ProcessTaskContentProps) {
  const priority = TASK_PRIORITY_MAP[task.priority as keyof typeof TASK_PRIORITY_MAP]
  const dueDate = task.due_date ? new Date(task.due_date) : null
  const isOverdue = dueDate && !task.is_completed && isPast(dueDate) && !isToday(dueDate)

  const isAngariacao = task.process_type === 'angariacao'
  const isNegocio = task.process_type === 'negocio'

  const secondaryHref = isAngariacao && task.property_id
    ? `/dashboard/imoveis/${task.property_id}`
    : isNegocio && task.negocio_id
      ? `/dashboard/crm/negocios/${task.negocio_id}`
      : null

  const secondaryLabel = isAngariacao ? 'Abrir imóvel' : 'Abrir negócio'
  const SecondaryIcon = isAngariacao ? Building2 : Handshake

  const header = (
    <div className="flex items-center justify-between px-6 py-4 border-b">
      <h3 className="text-base font-semibold tracking-tight">Tarefa do processo</h3>
      {variant === 'inline' && onClose && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )

  const body = (
    <div className="p-6 space-y-6">
      {/* Identificação do processo */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-medium rounded-full h-5 px-2 border-0',
              isAngariacao
                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                : isNegocio
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
            )}
          >
            {isAngariacao ? 'Angariação' : isNegocio ? 'Negócio' : 'Processo'}
          </Badge>
          {task.process_ref && (
            <span className="text-[10px] font-mono text-muted-foreground tracking-tight">
              {task.process_ref}
            </span>
          )}
        </div>

        <h2 className={cn(
          'text-xl font-semibold leading-tight tracking-tight',
          task.is_completed && 'line-through text-muted-foreground',
        )}>
          {task.title}
        </h2>

        {task.stage_name && (
          <p className="text-sm text-muted-foreground mt-1.5">
            {task.stage_name}
          </p>
        )}
      </div>

      {/* Meta row minimal */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm">
        {priority && (
          <span className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', priority.dot)} />
            <span className={priority.color}>{priority.label}</span>
          </span>
        )}
        {dueDate && (
          <span className={cn(
            'flex items-center gap-1.5',
            isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground',
          )}>
            <CalendarDays className="h-3.5 w-3.5" />
            {format(dueDate, 'PPP', { locale: pt })}
          </span>
        )}
        {task.property_title && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span className="truncate max-w-[200px]">{task.property_title}</span>
          </span>
        )}
      </div>

      {/* Acções — botões glassmorphic (não cards) */}
      <div className="space-y-2 pt-2">
        {task.process_id && (
          <Link href={`/dashboard/processos/${task.process_id}`} className="block">
            <button
              type="button"
              className={cn(
                'w-full rounded-full px-5 py-3.5 flex items-center gap-3',
                'bg-foreground text-background',
                'shadow-[0_8px_24px_-6px_rgba(0,0,0,0.35),0_2px_6px_-2px_rgba(0,0,0,0.2)]',
                'hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.4),0_4px_10px_-3px_rgba(0,0,0,0.25)]',
                'hover:-translate-y-[1px] transition-all duration-200',
                'group',
              )}
            >
              <Workflow className="h-4 w-4" />
              <span className="text-sm font-semibold tracking-tight">Ver processo</span>
              <ArrowRight className="h-4 w-4 ml-auto transition-transform group-hover:translate-x-0.5" />
            </button>
          </Link>
        )}

        {secondaryHref && (
          <Link href={secondaryHref} className="block">
            <button
              type="button"
              className={cn(
                'w-full rounded-full px-5 py-3 flex items-center gap-3',
                'bg-card/70 backdrop-blur-md border border-border/50',
                'shadow-[0_2px_10px_-2px_rgba(15,23,42,0.06),0_1px_3px_-1px_rgba(15,23,42,0.04)]',
                'hover:bg-card hover:border-border',
                'hover:shadow-[0_6px_20px_-4px_rgba(15,23,42,0.1),0_2px_6px_-2px_rgba(15,23,42,0.05)]',
                'hover:-translate-y-[1px] transition-all duration-200',
                'group',
              )}
            >
              <SecondaryIcon className="h-4 w-4 text-foreground/70" />
              <span className="text-sm font-medium tracking-tight">{secondaryLabel}</span>
              <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </Link>
        )}
      </div>
    </div>
  )

  if (variant === 'inline') {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className="flex-1 overflow-y-auto">{body}</div>
      </div>
    )
  }

  return (
    <>
      {header}
      <ScrollArea className="flex-1">{body}</ScrollArea>
    </>
  )
}
