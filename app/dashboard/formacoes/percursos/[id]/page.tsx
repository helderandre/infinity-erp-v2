'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, BookOpen, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CourseProgressBar } from '@/components/training/course-progress-bar'
import { TRAINING_ENROLLMENT_STATUS } from '@/lib/constants'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { TrainingLearningPath } from '@/types/training'

export default function PercursoDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <PercursoContent />
    </Suspense>
  )
}

function PercursoContent() {
  const router = useRouter()
  const params = useParams()
  const pathId = params.id as string
  const [path, setPath] = useState<TrainingLearningPath | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEnrolling, setIsEnrolling] = useState(false)

  const fetchPath = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/training/learning-paths/${pathId}`)
      if (!res.ok) throw new Error('Erro')
      setPath(await res.json())
    } catch {
      toast.error('Erro ao carregar percurso')
    } finally {
      setIsLoading(false)
    }
  }, [pathId])

  useEffect(() => { fetchPath() }, [fetchPath])

  const handleEnroll = async () => {
    setIsEnrolling(true)
    try {
      const res = await fetch(`/api/training/learning-paths/${pathId}/enroll`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro')
      }
      toast.success('Inscrição no percurso realizada!')
      fetchPath()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsEnrolling(false)
    }
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (!path) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Percurso não encontrado</p>
      <Button className="mt-4" asChild><Link href="/dashboard/formacoes/percursos">Voltar</Link></Button>
    </div>
  )

  const isEnrolled = !!path.enrollment
  const isCompleted = path.enrollment?.status === 'completed'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/formacoes/percursos"><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Link>
      </Button>

      <div className="space-y-4">
        <h1 className="text-3xl font-bold">{path.title}</h1>
        {path.description && <p className="text-muted-foreground">{path.description}</p>}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" />{path.courses?.length || 0} cursos</span>
          {path.is_mandatory && <Badge className="bg-amber-500/15 text-amber-500">Obrigatório</Badge>}
        </div>

        {isEnrolled && path.enrollment && (
          <CourseProgressBar percent={path.enrollment.progress_percent} showLabel size="md" />
        )}

        {!isEnrolled && (
          <Button size="lg" onClick={handleEnroll} disabled={isEnrolling}>
            {isEnrolling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Inscrever-se no Percurso
          </Button>
        )}
      </div>

      {/* Course Timeline */}
      <div className="space-y-0">
        {(path.courses || []).map((course, idx) => {
          const enrollment = (course as any).enrollment
          const isCourseDone = enrollment?.status === 'completed'
          const isLast = idx === (path.courses?.length || 0) - 1

          return (
            <div key={course.id} className="flex gap-4">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  isCourseDone ? 'bg-emerald-500 text-white' : 'bg-muted'
                )}>
                  {isCourseDone ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-sm font-medium">{idx + 1}</span>}
                </div>
                {!isLast && (
                  <div className={cn('w-0.5 flex-1 min-h-8', isCourseDone ? 'bg-emerald-500' : 'bg-muted')} />
                )}
              </div>

              {/* Course Card */}
              <Card
                className={cn(
                  'flex-1 mb-4 cursor-pointer transition-all hover:shadow-md',
                  isCourseDone && 'border-emerald-500/30'
                )}
                onClick={() => router.push(`/dashboard/formacoes/cursos/${course.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{course.title}</h3>
                      {course.summary && <p className="text-sm text-muted-foreground mt-1">{course.summary}</p>}
                    </div>
                    {enrollment && (
                      <Badge className={cn(
                        TRAINING_ENROLLMENT_STATUS[enrollment.status as keyof typeof TRAINING_ENROLLMENT_STATUS]?.bg,
                        TRAINING_ENROLLMENT_STATUS[enrollment.status as keyof typeof TRAINING_ENROLLMENT_STATUS]?.text,
                      )}>
                        {TRAINING_ENROLLMENT_STATUS[enrollment.status as keyof typeof TRAINING_ENROLLMENT_STATUS]?.label || enrollment.status}
                      </Badge>
                    )}
                  </div>
                  {enrollment && enrollment.progress_percent > 0 && (
                    <div className="mt-3">
                      <CourseProgressBar percent={enrollment.progress_percent} size="sm" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}
