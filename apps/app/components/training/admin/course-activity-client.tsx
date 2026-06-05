'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Users, ListChecks, FileQuestion, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ActivitySummaryTab } from './activity-summary-tab'
import { ActivityLessonsTab } from './activity-lessons-tab'
import { ActivityQuizzesTab } from './activity-quizzes-tab'
import { ActivityEnrollmentsTab } from './activity-enrollments-tab'
import { toast } from 'sonner'
import type { CourseActivityPayload } from '@/types/training'

interface Props {
  courseId: string
  initialTab?: string
}

const VALID_TABS = ['resumo', 'matriculados', 'licoes', 'quizzes'] as const
type TabKey = (typeof VALID_TABS)[number]

export function CourseActivityClient({ courseId, initialTab }: Props) {
  const router = useRouter()
  const search = useSearchParams()
  const queryTab = (search.get('tab') ?? initialTab ?? 'resumo') as TabKey
  const active: TabKey = VALID_TABS.includes(queryTab) ? queryTab : 'resumo'

  const [payload, setPayload] = useState<CourseActivityPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchActivity = useCallback(async () => {
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

  useEffect(() => { fetchActivity() }, [fetchActivity])

  const setTab = (value: string) => {
    const params = new URLSearchParams(search.toString())
    params.set('tab', value)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-8 sm:px-10 sm:py-10">
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-neutral-400 hover:text-white hover:bg-white/10"
              asChild
            >
              <Link href={`/dashboard/formacoes/gestao/${courseId}/editar`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <BarChart3 className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">Actividade</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {payload?.course?.title ?? 'Formação'}
          </h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed">
            Visão completa da actividade dos consultores matriculados neste curso.
          </p>
        </div>
      </div>

      {loading && !payload ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
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
        <Tabs value={active} onValueChange={setTab}>
          <TabsList className="bg-muted/50 rounded-full p-1 h-auto gap-0">
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
            <ActivityEnrollmentsTab courseId={courseId} />
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
  )
}
