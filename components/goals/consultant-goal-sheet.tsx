'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { ConsultantGoalDashboard } from '@/components/goals/consultant-goal-dashboard'
import { AICoachSheet } from '@/components/goals/ai-coach-sheet'

interface ConsultantGoalSheetProps {
  goalId: string | null
  consultantName?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConsultantGoalSheet({ goalId, consultantName, open, onOpenChange }: ConsultantGoalSheetProps) {
  const isMobile = useIsMobile()
  const [coachOpen, setCoachOpen] = useState(false)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
            'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
            isMobile
              ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
              : 'w-full data-[side=right]:sm:max-w-[720px] sm:rounded-l-3xl',
          )}
        >
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
          )}

          <div className="shrink-0 px-6 pt-8 pb-2 sm:pt-10">
            <div className="flex items-start justify-between gap-4">
              <SheetHeader className="p-0 gap-0 flex-1 min-w-0">
                <SheetTitle className="text-[20px] font-semibold leading-tight tracking-tight pr-10 truncate">
                  {consultantName || 'Consultor'}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-1">
                  Vista detalhada dos objetivos do consultor.
                </SheetDescription>
              </SheetHeader>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCoachOpen(true)}
                disabled={!goalId}
                className="rounded-full h-8 text-xs gap-1.5 shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                Coach
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-6">
            {goalId ? (
              <ConsultantGoalDashboard goalId={goalId} mode="manager-view" />
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Sem objetivo seleccionado.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AICoachSheet
        goalId={goalId}
        consultantName={consultantName}
        open={coachOpen}
        onOpenChange={setCoachOpen}
      />
    </>
  )
}
