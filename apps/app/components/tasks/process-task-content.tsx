'use client'

import Link from 'next/link'
import {
  Building2, X, Handshake, ArrowRight,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/types/task'
import { DueDateText, PriorityFlag } from '@/components/tasks/task-primitives'

interface ProcessTaskContentProps {
  task: TaskWithRelations
  variant?: 'sheet' | 'inline'
  onClose?: () => void
}

export function ProcessTaskContent({ task, variant = 'sheet', onClose }: ProcessTaskContentProps) {
  const dueDate = task.due_date ? new Date(task.due_date) : null

  const isAngariacao = task.process_type === 'angariacao'
  const isNegocio = task.process_type === 'negocio'

  // Abrir processo = abrir a página do imóvel/negócio na tab correcta.
  // Não fazemos mais navegação para /dashboard/processos/[id] a partir daqui.
  const primaryHref = isAngariacao && task.property_id
    ? `/dashboard/imoveis/${task.property_id}?tab=processos&sub=angariacao`
    : isNegocio && task.negocio_id
      ? `/dashboard/crm/negocios/${task.negocio_id}?tab=processos`
      : null

  const PrimaryIcon = isAngariacao ? Building2 : Handshake
  const primaryLabel = isAngariacao ? 'Ver no imóvel' : 'Ver no negócio'

  const header = (
    <div className="flex items-center justify-between px-5 py-3 border-b">
      <h3 className="text-[13px] font-semibold tracking-tight text-muted-foreground uppercase">
        Tarefa do processo
      </h3>
      {variant === 'inline' && onClose && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )

  const body = (
    <div className="p-5 space-y-5">
      {/* Identificação do processo */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
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
              #{task.process_ref}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <h2 className={cn(
            'text-lg font-semibold leading-tight tracking-tight',
            task.is_completed && 'line-through text-muted-foreground',
          )}>
            {task.title}
          </h2>
          {!task.is_completed && (
            <div className="shrink-0 mt-1">
              <PriorityFlag priority={task.priority} />
            </div>
          )}
        </div>

        {task.stage_name && (
          <p className="text-[13px] text-muted-foreground mt-1.5">
            {task.stage_name}
          </p>
        )}
      </div>

      {/* Meta row minimal — same language as the row */}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 text-[11.5px]">
        {dueDate && (
          <DueDateText
            date={dueDate}
            isCompleted={task.is_completed}
            variant="long"
          />
        )}
        {task.property_title && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate max-w-[200px]">{task.property_title}</span>
          </span>
        )}
      </div>

      {/* Acção primária — abre o imóvel ou o negócio na tab processos */}
      {primaryHref && (
        <div className="pt-2">
          <Link href={primaryHref} className="block">
            <button
              type="button"
              className={cn(
                'w-full rounded-xl px-4 py-3 flex items-center gap-3',
                'bg-foreground text-background',
                'hover:bg-foreground/90 transition-colors duration-200',
                'group',
              )}
            >
              <PrimaryIcon className="h-4 w-4" />
              <span className="text-[13px] font-semibold tracking-tight">{primaryLabel}</span>
              <ArrowRight className="h-4 w-4 ml-auto transition-transform group-hover:translate-x-0.5" />
            </button>
          </Link>
        </div>
      )}
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
