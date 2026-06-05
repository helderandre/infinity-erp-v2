'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Clock, AlertTriangle, ChevronLeft, CheckCircle2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { CourseProgressBar } from '@/components/training/course-progress-bar'
import { TRAINING_ENROLLMENT_STATUS, TRAINING_DIFFICULTY_COLORS, formatDate } from '@/lib/constants'
import { cn } from '@/lib/utils'

export default function MeusFormacoes() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MeusFormacoesContent />
    </Suspense>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  )
}

function MeusFormacoesContent() {
  const router = useRouter()
  const [tab, setTab] = useState('in_progress')
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchEnrollments = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (tab !== 'all') params.set('status', tab)
      const res = await fetch(`/api/training/my-courses?${params.toString()}`)
      if (!res.ok) throw new Error('Erro')
      const data = await res.json()
      setEnrollments(data.data || [])
    } catch {
      setEnrollments([])
    } finally {
      setIsLoading(false)
    }
  }, [tab])

  useEffect(() => { fetchEnrollments() }, [fetchEnrollments])

  const now = new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard/formacoes"><ChevronLeft className="h-4 w-4" /></Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Os Meus Cursos</h1>
          </div>
          <p className="text-muted-foreground ml-10">As suas inscrições e progresso</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="in_progress">Em Progresso</TabsTrigger>
          <TabsTrigger value="completed">Concluídos</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : enrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhuma inscrição encontrada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {tab === 'in_progress'
                  ? 'Não tem formações em progresso.'
                  : tab === 'completed'
                  ? 'Ainda não concluiu nenhuma formação.'
                  : 'Ainda não está inscrito em nenhuma formação.'}
              </p>
              <Button className="mt-4" asChild>
                <Link href="/dashboard/formacoes">Explorar Formações</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrollments.map((enrollment: any) => {
                const course = enrollment.course || enrollment.TEMP_training_courses || {}
                const isOverdue = enrollment.deadline && new Date(enrollment.deadline) < now && enrollment.status !== 'completed'
                const deadlineSoon = enrollment.deadline && !isOverdue && (new Date(enrollment.deadline).getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000
                const statusConfig = TRAINING_ENROLLMENT_STATUS[enrollment.status as keyof typeof TRAINING_ENROLLMENT_STATUS]

                return (
                  <Card
                    key={enrollment.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]',
                      isOverdue && 'border-red-500/30',
                      enrollment.status === 'completed' && 'border-emerald-500/30'
                    )}
                    onClick={() => router.push(`/dashboard/formacoes/cursos/${enrollment.course_id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-semibold line-clamp-2">{course.title || 'Formação'}</h3>
                        {enrollment.status === 'completed' && (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        )}
                      </div>

                      {statusConfig && (
                        <Badge className={cn(statusConfig.bg, statusConfig.text, 'mb-3')}>
                          {statusConfig.label}
                        </Badge>
                      )}

                      <CourseProgressBar percent={enrollment.progress_percent || 0} showLabel size="sm" />

                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        {course.estimated_duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {Math.round(course.estimated_duration_minutes / 60)}h
                          </span>
                        )}
                        <span>Inscrito: {formatDate(enrollment.enrolled_at)}</span>
                      </div>

                      {isOverdue && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-red-500">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Prazo expirado: {formatDate(enrollment.deadline)}
                        </div>
                      )}
                      {deadlineSoon && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-amber-500">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Prazo: {formatDate(enrollment.deadline)}
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t">
                        <Button size="sm" className="w-full" variant={enrollment.status === 'completed' ? 'outline' : 'default'}>
                          {enrollment.status === 'completed' ? (
                            <>Rever Formação</>
                          ) : (
                            <><Play className="h-3.5 w-3.5 mr-1" />Continuar</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
