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
import { Check, Eye, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import type { AngariacaoStep } from './steps'
import type { StepStatus } from './process-timeline'
import { StepDetailContent } from './step-detail-content'

interface StepDetailSheetProps {
  step: AngariacaoStep | null
  status: StepStatus
  open: boolean
  onOpenChange: (open: boolean) => void
  doneBy?: string | null
  doneAt?: string | null
  onComplete?: (step: AngariacaoStep) => void
  propertyId?: string | null
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
}: StepDetailSheetProps) {
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
          <div className="flex items-center gap-3">
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

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <StepDetailContent
            step={step}
            status={status}
            doneBy={doneBy}
            doneAt={doneAt}
            onComplete={() => onComplete?.(step)}
            propertyId={propertyId}
          />

          {/* Histórico compacto */}
          <div>
            <p className="mb-2 px-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
              Histórico
            </p>
            <ul className="space-y-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
              {status === 'done' && (
                <HistoryRow
                  icon={CheckCircle2}
                  text={`Concluído${doneBy ? ` por ${doneBy}` : ''}`}
                  when={doneAt ?? 'há 2 dias'}
                />
              )}
              {status === 'current' && (
                <HistoryRow icon={Loader2} text="Passo em curso" when="agora" />
              )}
              <HistoryRow icon={Eye} text="Visualizado pela equipa" when="há 1 dia" />
            </ul>
          </div>
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
  )
}

function HistoryRow({
  icon: EIcon,
  text,
  when,
}: {
  icon: typeof Eye
  text: string
  when: string
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <EIcon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{text}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {when}
        </p>
      </div>
    </li>
  )
}
