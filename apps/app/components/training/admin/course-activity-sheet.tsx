'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Users, ListChecks, FileQuestion } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { ActivitySummaryTab } from './activity-summary-tab'
import { ActivityLessonsTab } from './activity-lessons-tab'
import { ActivityQuizzesTab } from './activity-quizzes-tab'
import { ActivityEnrollmentsTab } from './activity-enrollments-tab'
import { toast } from 'sonner'
import type { CourseActivityPayload } from '@/types/training'

interface Props {
  courseId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const VALID_TABS = ['resumo', 'matriculados', 'licoes', 'quizzes'] as const
type TabKey = (typeof VALID_TABS)[number]

/**
 * Sheet "Actividade do curso" — mesma informação da página
 * `/gestao/[id]/actividade` (quem viu, progresso, lições, quizzes) mas
 * apresentada num Sheet glassmorphic, sem navegar para outra página.
 * Estado da tab é local (não toca no URL da página de gestão).
 */
export function CourseActivitySheet({ courseId, open, onOpenChange }: Props) {
  const isMobile = useIsMobile()
  const [active, setActive] = useState<TabKey>('resumo')
  const [payload, setPayload] = useState<CourseActivityPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchActivity = useCallback(async () => {
    if (!courseId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/training/admin/courses/${courseId}/activity`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Erro ao carregar actividade')
      }
      setPayload(await res.json())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar actividade')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  // Refetch + reset tab whenever the sheet opens for a (new) course.
  useEffect(() => {
    if (open && courseId) {
      setActive('resumo')
      setPayload(null)
      fetchActivity()
    }
  }, [open, courseId, fetchActivity])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0 border-border/40 shadow-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[920px] sm:rounded-l-3xl',
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
          <SheetTitle className="flex items-center gap-2 text-base pr-8">
            <BarChart3 className="h-5 w-5" />
            {payload?.course?.title ?? 'Actividade'}
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Quem viu o curso e o progresso de cada utilizador.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {loading && !payload ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : !payload ? (
            <div className="rounded-xl border py-16 text-center">
              <p className="text-sm text-muted-foreground">Não foi possível carregar a actividade.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchActivity}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Tabs value={active} onValueChange={(v) => setActive(v as TabKey)}>
              <TabsList className="bg-muted/50 rounded-full p-1 h-auto gap-0 flex-wrap">
                <TabsTrigger value="resumo" className="rounded-full px-4 py-1.5 text-xs data-[state=active]:bg-background">
                  <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                  Resumo
                </TabsTrigger>
                <TabsTrigger value="matriculados" className="rounded-full px-4 py-1.5 text-xs data-[state=active]:bg-background">
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Matriculados
                </TabsTrigger>
                <TabsTrigger value="licoes" className="rounded-full px-4 py-1.5 text-xs data-[state=active]:bg-background">
                  <ListChecks className="h-3.5 w-3.5 mr-1.5" />
                  Lições
                </TabsTrigger>
                <TabsTrigger value="quizzes" className="rounded-full px-4 py-1.5 text-xs data-[state=active]:bg-background">
                  <FileQuestion className="h-3.5 w-3.5 mr-1.5" />
                  Quizzes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="resumo" className="mt-6">
                <ActivitySummaryTab payload={payload} />
              </TabsContent>
              <TabsContent value="matriculados" className="mt-6">
                {courseId && <ActivityEnrollmentsTab courseId={courseId} />}
              </TabsContent>
              <TabsContent value="licoes" className="mt-6">
                <ActivityLessonsTab lessons={payload.lessons} />
              </TabsContent>
              <TabsContent value="quizzes" className="mt-6">
                <ActivityQuizzesTab quizzes={payload.quizzes} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
