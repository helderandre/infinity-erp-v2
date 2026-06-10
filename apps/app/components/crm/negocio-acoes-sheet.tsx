'use client'

import { CheckSquare, CalendarPlus, Zap } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { useNegocioTasks } from '@/hooks/use-negocio-tasks'
import { useNegocioActivities } from '@/hooks/use-negocio-activities'
import { ActivityStrip } from '@/components/negocios/dashboard/activity-strip'
import { PorFazerPanel, mergeActivitiesAndCompletedTasks } from '@/components/crm/negocio-inicio-extras'
import { useEffect } from 'react'

// Canonical "simple" button — outline pill, neutral surface, icon + label.
const PILL =
  'flex w-full items-center justify-center gap-1.5 h-9 rounded-full border border-border/60 bg-background text-xs font-medium text-foreground/85 hover:bg-muted/50 active:scale-[0.98] transition-colors'

interface NegocioAcoesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientName: string
  negocioId: string
  leadId: string | null | undefined
  onCreateTask: () => void
  onCreateEvent: () => void
  /** Bump para forçar refetch (vem do parent após criar uma tarefa/nota). */
  refreshKey?: number
}

export function NegocioAcoesSheet({
  open, onOpenChange, clientName, negocioId, leadId,
  onCreateTask, onCreateEvent, refreshKey,
}: NegocioAcoesSheetProps) {
  const isMobile = useIsMobile()
  const tasks = useNegocioTasks(negocioId)
  const acts = useNegocioActivities(leadId, negocioId)

  // Refetch when parent bumps the key (e.g. after a quick task/note was saved)
  useEffect(() => {
    if (refreshKey === undefined) return
    void tasks.refetch()
    void acts.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const merged = mergeActivitiesAndCompletedTasks(acts.activities, tasks.completedRecent, negocioId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0 border-border/40 shadow-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full sm:max-w-[560px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}
        <SheetHeader
          className={cn(
            'px-6 pb-4 border-b border-border/40 shrink-0',
            isMobile ? 'pt-8' : 'pt-6',
          )}
        >
          <SheetTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5" />
            Ações
          </SheetTitle>
          <SheetDescription className="text-[12px] truncate">{clientName}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {/* Quick actions — simple outline pills (Tarefa · Evento). As notas
              vivem no feed da tab Início. */}
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={onCreateTask} className={PILL} title="Criar tarefa para este negócio">
              <CheckSquare className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              Tarefa
            </button>
            <button type="button" onClick={onCreateEvent} className={PILL} title="Criar evento (reunião, visita, follow-up)">
              <CalendarPlus className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Evento
            </button>
          </div>

          {/* Tabbed Por fazer / Atividade recente */}
          <Tabs defaultValue="por-fazer" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-full border border-border/50 bg-muted/50 p-0.5 h-10">
              <TabsTrigger
                value="por-fazer"
                className="rounded-full text-xs font-medium tracking-tight data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                Por fazer
              </TabsTrigger>
              <TabsTrigger
                value="atividade"
                className="rounded-full text-xs font-medium tracking-tight data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                Atividade
              </TabsTrigger>
            </TabsList>
            <TabsContent value="por-fazer" className="mt-3">
              <PorFazerPanel
                pending={tasks.pending}
                isLoading={tasks.isLoading}
                onToggle={tasks.toggle}
                onCreateTask={onCreateTask}
              />
            </TabsContent>
            <TabsContent value="atividade" className="mt-3">
              <ActivityStrip activities={merged} isLoading={acts.isLoading || tasks.isLoading} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
