'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { Check } from 'lucide-react'
import type { StepStatus } from '../angariacao-timeline/process-timeline'
import type { NegocioStep } from './negocio-steps'
import { NegocioStepDetailContent } from './negocio-step-detail-content'

const PILL: Record<StepStatus, { label: string; cls: string }> = {
  done: {
    label: 'Concluído',
    cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  current: {
    label: 'Em curso',
    cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
  },
  pending: {
    label: 'Pendente',
    cls: 'bg-muted text-muted-foreground border-border',
  },
}

interface NegocioStepDetailSheetProps {
  step: NegocioStep | null
  /** Uma ou mais proc_tasks que o passo agrega. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[]
  status: StepStatus
  open: boolean
  onOpenChange: (open: boolean) => void
  processId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deal?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process?: any
  onTaskUpdate: () => void
}

/**
 * Sheet de detalhe de um passo do fecho de negócio. Espelha o design da sheet
 * da angariação (`StepDetailSheet`) — backdrop-blur, header com ícone + "Passo
 * N" + pill de estado — mas o corpo renderiza as subtarefas REAIS do passo
 * (via `<SubtaskCardList>`), pelo que a conclusão passa pelo completer real.
 */
export function NegocioStepDetailSheet({
  step,
  tasks,
  status,
  open,
  onOpenChange,
  processId,
  deal,
  process,
  onTaskUpdate,
}: NegocioStepDetailSheetProps) {
  const isMobile = useIsMobile()
  if (!step) return null
  const Icon = step.icon
  const pill = PILL[status]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-0 overflow-hidden border-border/40 p-0 shadow-2xl',
          'bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[92dvh] rounded-t-3xl'
            : 'h-full w-full data-[side=right]:sm:max-w-[820px] sm:rounded-l-3xl'
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 z-20 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/25" />
        )}
        <SheetHeader className="shrink-0 space-y-0 border-b border-border/40 px-6 pb-4 pt-6">
          <div className="flex items-center gap-3 pr-8">
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                status === 'done'
                  ? 'bg-emerald-500 text-white'
                  : status === 'current'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {status === 'done' ? (
                <Check className="h-5 w-5" />
              ) : (
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                Passo {step.order}
              </p>
              <SheetTitle className="text-base leading-snug">
                {step.label}
              </SheetTitle>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                pill.cls
              )}
            >
              {pill.label}
            </span>
          </div>
          <SheetDescription className="sr-only">
            Detalhe do passo {step.label}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>

          {tasks.length > 0 ? (
            <NegocioStepDetailContent
              stepKey={step.key}
              tasks={tasks}
              processId={processId}
              deal={deal}
              process={process}
              onTaskUpdate={onTaskUpdate}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Este passo não se aplica a este cenário.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
