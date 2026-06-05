'use client'

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LessonPlayer } from '@/components/training/lesson-player'
import { LessonPdfViewer } from '@/components/training/lesson-pdf-viewer'
import { LessonTextContent } from '@/components/training/lesson-text-content'
import { LessonSidebar } from '@/components/training/lesson-sidebar'
import { LessonComments } from '@/components/training/lesson-comments'
import { LessonRating } from '@/components/training/lesson-rating'
import { LessonReportDialog } from '@/components/training/lesson-report-dialog'
import { LessonQuiz } from '@/components/training/lesson-quiz'
import { LessonMaterials } from '@/components/training/lesson-materials'
import { useTrainingLesson } from '@/hooks/use-training-lesson'
import { useBreadcrumbSet } from '@/hooks/use-breadcrumb-overrides'
import { toast } from 'sonner'
import type { TrainingCourse, TrainingLesson as TLesson } from '@/types/training'

function LessonSkeleton() {
  return (
    <div className="flex h-full min-h-0">
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex w-80 shrink-0 border-r flex-col bg-muted/30">
        <div className="space-y-3 border-b p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-48" />
          <div className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
        <div className="p-2 space-y-3">
          {[1, 2].map((m) => (
            <div key={m} className="space-y-1.5 px-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-36" />
              {[1, 2, 3].map((l) => (
                <Skeleton key={l} className="h-9 w-full rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="space-y-6 p-4 md:p-6 mx-auto max-w-[1200px] w-full">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export default function LessonPage() {
  return (
    <Suspense fallback={<LessonSkeleton />}>
      <LessonContent />
    </Suspense>
  )
}

function LessonContent() {
  const params = useParams()
  const courseId = params.id as string
  const lessonId = params.lessonId as string
  const [course, setCourse] = useState<TrainingCourse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const { updateProgress, sendHeartbeat, markCompleted, isSaving } = useTrainingLesson({ courseId, lessonId })

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

  // Override breadcrumbs with actual course and lesson names
  useBreadcrumbSet(useMemo(() => ({
    ...(course ? { cursos: course.title } : {}),
    ...(currentLesson ? { licoes: currentLesson.title } : {}),
  }), [course, currentLesson]))

  const [localCompleted, setLocalCompleted] = useState(false)
  const [liveWatchPercent, setLiveWatchPercent] = useState(0)

  const handleMarkCompleted = async () => {
    const result = await markCompleted()
    if (result.ok) {
      setLocalCompleted(true)
      // Update sidebar progress locally
      setCourse(prev => {
        if (!prev?.modules) return prev
        return {
          ...prev,
          modules: prev.modules.map(m => ({
            ...m,
            lessons: m.lessons?.map(l =>
              l.id === lessonId
                ? { ...l, progress: { ...(l.progress || {} as any), status: 'completed' as const } }
                : l
            ),
          })),
        }
      })
    }
    // Non-ok already toasted inside the hook (handles the 403 gate specifically).
  }

  const isLessonCompleted = localCompleted || currentLesson?.progress?.status === 'completed'

  const handleProgressUpdate = useCallback((data: Parameters<typeof updateProgress>[0]) => {
    if (data.status === 'completed') setLocalCompleted(true)
    if (data.video_watch_percent != null) setLiveWatchPercent(data.video_watch_percent)
    updateProgress(data)
  }, [updateProgress])

  const handleWatchPercentChange = useCallback((percent: number) => {
    setLiveWatchPercent(percent)
  }, [])

  if (isLoading) return <LessonSkeleton />
  if (!course || !currentLesson) return (
    <div className="flex flex-col items-center py-16">
      <h3 className="font-semibold">Lição não encontrada</h3>
      <Link href={`/dashboard/formacoes/cursos/${courseId}`} className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"><ArrowLeft className="h-3.5 w-3.5" />Voltar ao Curso</Link>
    </div>
  )

  const sidebarModules = (course.modules || []).map(m => ({
    id: m.id,
    title: m.title,
    lessons: (m.lessons || []).map(l => {
      const isCurrent = l.id === lessonId
      const status = isCurrent && localCompleted ? 'completed' : l.progress?.status
      const percent = isCurrent
        ? (localCompleted ? 100 : liveWatchPercent)
        : (l.progress?.video_watch_percent ?? 0)
      return {
        id: l.id,
        title: l.title,
        content_type: l.content_type,
        estimated_minutes: l.estimated_minutes,
        progress: l.progress || isCurrent ? { status: status ?? null, video_watch_percent: percent } : null,
      }
    }),
  }))

  return (
    <div className="flex h-full min-h-0">
      {/* Sidebar — scroll independente */}
      <div className="hidden lg:flex w-80 shrink-0 border-r overflow-y-auto">
        <LessonSidebar
          modules={sidebarModules}
          currentLessonId={lessonId}
          courseId={courseId}
          courseTitle={course.title}
          progressPercent={course.enrollment?.progress_percent || 0}
        />
      </div>

      {/* Main Content — scroll independente */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="space-y-6 p-4 md:p-6 mx-auto max-w-[1200px] w-full">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{currentLesson.title}</h1>
              {currentLesson.description && (
                <p className="text-sm text-muted-foreground mt-1">{currentLesson.description}</p>
              )}
            </div>
            <LessonReportDialog lessonId={lessonId} courseId={courseId} />
          </div>

          {/* Lesson Content */}
          {currentLesson.content_type === 'video' && currentLesson.video_url && (
            <LessonPlayer
              lesson={currentLesson}
              progress={currentLesson.progress}
              onProgressUpdate={handleProgressUpdate}
              onWatchPercentChange={handleWatchPercentChange}
              onHeartbeat={sendHeartbeat}
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
            <div className="rounded-lg border p-8 text-center">
              <p className="text-muted-foreground mb-4">Este conteúdo abre num link externo.</p>
              <Button asChild>
                <a href={currentLesson.external_url} target="_blank" rel="noopener noreferrer">
                  Abrir Link Externo
                </a>
              </Button>
            </div>
          )}
          {/* Quiz — só renderiza se a lição é do tipo quiz */}
          {currentLesson.content_type === 'quiz' && (
            <LessonQuiz
              lessonId={lessonId}
              courseId={courseId}
              isMainContent
              onQuizPassed={handleMarkCompleted}
            />
          )}

          {/* Materiais de Apoio */}
          <LessonMaterials lessonId={lessonId} courseId={courseId} />

          {/* Rating + Navigation + Complete */}
          <LessonRating
            lessonId={lessonId}
            courseId={courseId}
            prevLesson={prevLesson ? { id: prevLesson.id, title: prevLesson.title } : null}
            nextLesson={nextLesson ? { id: nextLesson.id, title: nextLesson.title } : null}
            courseLink={`/dashboard/formacoes/cursos/${courseId}`}
            isCompleted={isLessonCompleted}
            onMarkCompleted={handleMarkCompleted}
            isSaving={isSaving}
            contentType={currentLesson.content_type}
            watchPercent={
              currentLesson.content_type === 'video'
                ? Math.max(liveWatchPercent, currentLesson.progress?.video_watch_percent ?? 0)
                : 100
            }
          />

          {/* Comments */}
          <LessonComments lessonId={lessonId} courseId={courseId} />
        </div>
      </div>
    </div>
  )
}
