'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useState } from 'react'
import { Check, History } from 'lucide-react'
import type { AngariacaoStep } from './steps'
import type { StepStatus } from './process-timeline'
import { StepDetailContent } from './step-detail-content'
import { ProcessHistorySheet } from './process-history-sheet'

interface StepDetailSheetProps {
  step: AngariacaoStep | null
  status: StepStatus
  open: boolean
  onOpenChange: (open: boolean) => void
  doneBy?: string | null
  doneAt?: string | null
  onComplete?: (step: AngariacaoStep) => void
  propertyId?: string | null
  ownerId?: string | null
  consultantId?: string | null
  processId?: string | null
}

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

export function StepDetailSheet({
  step,
  status,
  open,
  onOpenChange,
  doneBy,
  doneAt,
  onComplete,
  propertyId,
  ownerId,
  consultantId,
  processId,
}: StepDetailSheetProps) {
  const isMobile = useIsMobile()
  const [historyOpen, setHistoryOpen] = useState(false)
  if (!step) return null
  const Icon = step.icon
  const pill = PILL[status]

  return (
    <>
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
            {processId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Histórico</span>
              </Button>
            )}
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

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <StepDetailContent
            step={step}
            status={status}
            doneBy={doneBy}
            doneAt={doneAt}
            onComplete={() => onComplete?.(step)}
            propertyId={propertyId}
            ownerId={ownerId}
            consultantId={consultantId}
            processId={processId}
          />
        </div>

        {status === 'current' && step.action !== 'generate_doc' && (
          <div className="shrink-0 border-t border-border/40 px-6 py-4">
            <Button className="w-full" onClick={() => onComplete?.(step)}>
              {step.cta}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>

    <ProcessHistorySheet
      processId={processId ?? null}
      open={historyOpen}
      onOpenChange={setHistoryOpen}
    />
    </>
  )
}
