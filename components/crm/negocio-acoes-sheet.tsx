'use client'

import { CheckSquare, CalendarPlus, StickyNote, Zap } from 'lucide-react'
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

interface NegocioAcoesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientName: string
  negocioId: string
  leadId: string | null | undefined
  onCreateTask: () => void
  onCreateEvent: () => void
  onCreateNote: () => void
  /** Bump para forçar refetch (vem do parent após criar uma tarefa/nota). */
  refreshKey?: number
}

export function NegocioAcoesSheet({
  open, onOpenChange, clientName, negocioId, leadId,
  onCreateTask, onCreateEvent, onCreateNote, refreshKey,
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
          {/* Quick actions — superfície neutra translúcida + pílula de ícone
              com cor subtil. Mesma linguagem dos 3 botões principais. */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={onCreateTask}
              className="group inline-flex flex-col items-center justify-center gap-1.5 h-[72px] rounded-2xl border border-border/40 bg-background/55 supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl shadow-[0_4px_14px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-background/75 hover:shadow-[0_8px_22px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.14)] active:scale-[0.98] transition-all duration-200"
              title="Criar tarefa para este negócio"
            >
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-teal-400/25 to-teal-600/5 ring-1 ring-inset ring-teal-500/25 group-hover:ring-teal-500/35 transition-colors">
                <CheckSquare className="h-3.5 w-3.5 text-teal-700 dark:text-teal-300" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-medium tracking-tight text-foreground/85">Tarefa</span>
            </button>
            <button
              type="button"
              onClick={onCreateEvent}
              className="group inline-flex flex-col items-center justify-center gap-1.5 h-[72px] rounded-2xl border border-border/40 bg-background/55 supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl shadow-[0_4px_14px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-background/75 hover:shadow-[0_8px_22px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.14)] active:scale-[0.98] transition-all duration-200"
              title="Criar evento (reunião, visita, follow-up)"
            >
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400/25 to-indigo-600/5 ring-1 ring-inset ring-indigo-500/25 group-hover:ring-indigo-500/35 transition-colors">
                <CalendarPlus className="h-3.5 w-3.5 text-indigo-700 dark:text-indigo-300" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-medium tracking-tight text-foreground/85">Evento</span>
            </button>
            <button
              type="button"
              onClick={onCreateNote}
              className="group inline-flex flex-col items-center justify-center gap-1.5 h-[72px] rounded-2xl border border-border/40 bg-background/55 supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl shadow-[0_4px_14px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-background/75 hover:shadow-[0_8px_22px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.14)] active:scale-[0.98] transition-all duration-200"
              title="Nota rápida"
            >
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-amber-400/25 to-amber-600/5 ring-1 ring-inset ring-amber-500/30 group-hover:ring-amber-500/40 transition-colors">
                <StickyNote className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-medium tracking-tight text-foreground/85">Nota</span>
            </button>
          </div>

          {/* Tabbed Por fazer / Atividade recente — pill picker glassmórfico */}
          <Tabs defaultValue="por-fazer" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-full border border-border/40 bg-background/55 supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl shadow-[0_4px_14px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] p-0.5 h-10">
              <TabsTrigger
                value="por-fazer"
                className="rounded-full text-xs font-medium tracking-tight data-[state=active]:bg-background/95 data-[state=active]:shadow-sm transition-all"
              >
                Por fazer
              </TabsTrigger>
              <TabsTrigger
                value="atividade"
                className="rounded-full text-xs font-medium tracking-tight data-[state=active]:bg-background/95 data-[state=active]:shadow-sm transition-all"
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
