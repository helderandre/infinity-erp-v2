'use client'

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LessonPlayer } from '@/components/training/lesson-player'
import { LessonPdfViewer } from '@/components/training/lesson-pdf-viewer'
import { LessonTextContent } from '@/components/training/lesson-text-content'
import { LessonSidebar } from '@/components/training/lesson-sidebar'
import { LessonComments } from '@/components/training/lesson-comments'
import { useTrainingLesson } from '@/hooks/use-training-lesson'
import { toast } from 'sonner'
import type { TrainingCourse, TrainingLesson as TLesson } from '@/types/training'

export default function LessonPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <LessonContent />
    </Suspense>
  )
}

function LessonContent() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const lessonId = params.lessonId as string
  const [course, setCourse] = useState<TrainingCourse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const { updateProgress, markCompleted, isSaving } = useTrainingLesson({ courseId, lessonId })

  const fetchCourse = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/training/courses/${courseId}`)
      if (!res.ok) throw new Error('Erro')
      setCourse(await res.json())
    } catch {
      toast.error('Erro ao carregar formação')
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => { fetchCourse() }, [fetchCourse])

  const allLessons = useMemo(() => {
    if (!course?.modules) return []
    return course.modules
      .sort((a, b) => a.order_index - b.order_index)
      .flatMap(m => (m.lessons || []).sort((a, b) => a.order_index - b.order_index))
  }, [course])

  const currentLesson = allLessons.find(l => l.id === lessonId)
  const currentIndex = allLessons.findIndex(l => l.id === lessonId)
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

  const handleMarkCompleted = async () => {
    const ok = await markCompleted()
    if (ok) {
      toast.success('Lição marcada como concluída!')
      fetchCourse()
    } else {
      toast.error('Erro ao marcar como concluída')
    }
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (!course || !currentLesson) return (
    <div className="flex flex-col items-center py-16">
      <h3 className="font-semibold">Lição não encontrada</h3>
      <Button className="mt-4" asChild><Link href={`/dashboard/formacoes/cursos/${courseId}`}>Voltar ao Curso</Link></Button>
    </div>
  )

  const sidebarModules = (course.modules || []).map(m => ({
    id: m.id,
    title: m.title,
    lessons: (m.lessons || []).map(l => ({
      id: l.id,
      title: l.title,
      content_type: l.content_type,
      estimated_minutes: l.estimated_minutes,
      progress: l.progress ? { status: l.progress.status } : null,
    })),
  }))

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="hidden lg:block w-80 shrink-0">
        <LessonSidebar
          modules={sidebarModules}
          currentLessonId={lessonId}
          courseId={courseId}
          courseTitle={course.title}
          progressPercent={course.enrollment?.progress_percent || 0}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href={`/dashboard/formacoes/cursos/${courseId}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />Voltar ao Curso
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{currentLesson.title}</h1>
          {currentLesson.description && (
            <p className="text-sm text-muted-foreground mt-1">{currentLesson.description}</p>
          )}
        </div>

        {/* Lesson Content */}
        {currentLesson.content_type === 'video' && currentLesson.video_url && (
          <LessonPlayer
            lesson={currentLesson}
            progress={currentLesson.progress}
            onProgressUpdate={updateProgress}
          />
        )}
        {currentLesson.content_type === 'pdf' && currentLesson.pdf_url && (
          <LessonPdfViewer
            pdfUrl={currentLesson.pdf_url}
            title={currentLesson.title}
            onComplete={handleMarkCompleted}
          />
        )}
        {currentLesson.content_type === 'text' && currentLesson.text_content && (
          <LessonTextContent
            content={currentLesson.text_content}
            title={currentLesson.title}
            onComplete={handleMarkCompleted}
          />
        )}
        {currentLesson.content_type === 'external_link' && currentLesson.external_url && (
          <div className="space-y-4">
            <div className="rounded-lg border p-8 text-center">
              <p className="text-muted-foreground mb-4">Este conteúdo abre num link externo.</p>
              <Button asChild>
                <a href={currentLesson.external_url} target="_blank" rel="noopener noreferrer">
                  Abrir Link Externo
                </a>
              </Button>
            </div>
            {currentLesson.progress?.status !== 'completed' && (
              <Button onClick={handleMarkCompleted} disabled={isSaving} className="w-full">
                <CheckCircle2 className="h-4 w-4 mr-2" />Marcar como Concluído
              </Button>
            )}
          </div>
        )}

        {/* Mark as completed for non-auto-complete types */}
        {currentLesson.content_type !== 'video' && currentLesson.progress?.status !== 'completed' && currentLesson.content_type !== 'pdf' && currentLesson.content_type !== 'text' && currentLesson.content_type !== 'external_link' && (
          <Button onClick={handleMarkCompleted} disabled={isSaving} className="w-full">
            <CheckCircle2 className="h-4 w-4 mr-2" />Marcar como Concluído
          </Button>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between border-t pt-4">
          {prevLesson ? (
            <Button variant="outline" asChild>
              <Link href={`/dashboard/formacoes/cursos/${courseId}/licoes/${prevLesson.id}`}>
                <ChevronLeft className="h-4 w-4 mr-1" />{prevLesson.title}
              </Link>
            </Button>
          ) : <div />}
          {nextLesson ? (
            <Button asChild>
              <Link href={`/dashboard/formacoes/cursos/${courseId}/licoes/${nextLesson.id}`}>
                {nextLesson.title}<ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/dashboard/formacoes/cursos/${courseId}`}>
                Voltar ao Curso
              </Link>
            </Button>
          )}
        </div>

        {/* Comments */}
        <LessonComments lessonId={lessonId} courseId={courseId} />
      </div>
    </div>
  )
}
