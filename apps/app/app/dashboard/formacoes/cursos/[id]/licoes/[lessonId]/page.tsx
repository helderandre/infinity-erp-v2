'use client'

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, ListVideo, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LessonPlayer } from '@/components/training/lesson-player'
import { LessonPdfViewer } from '@/components/training/lesson-pdf-viewer'
import { LessonTextContent } from '@/components/training/lesson-text-content'
import { LessonSidebar } from '@/components/training/lesson-sidebar'
import { LessonComments } from '@/components/training/lesson-comments'
import { LessonRating } from '@/components/training/lesson-rating'
import { LessonQuiz } from '@/components/training/lesson-quiz'
import { LessonMaterials } from '@/components/training/lesson-materials'
import { LessonCurriculumSheet } from '@/components/training/lesson-curriculum-sheet'
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
  const currentModule = course?.modules?.find(m => (m.lessons || []).some(l => l.id === lessonId))
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
  const [curriculumOpen, setCurriculumOpen] = useState(false)
  const [composeCommentOpen, setComposeCommentOpen] = useState(false)

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

  // Primary lesson content (video/pdf/text/link/quiz). Built once and rendered
  // in either the desktop or the mobile layout so the player mounts only once.
  const mainContent = (
    <>
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
      {currentLesson.content_type === 'quiz' && (
        <LessonQuiz
          lessonId={lessonId}
          courseId={courseId}
          isMainContent
          onQuizPassed={handleMarkCompleted}
        />
      )}
    </>
  )

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

      {/* Main Content — scroll independente + barra inferior mobile */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-6 max-sm:space-y-5 p-4 md:p-6 mx-auto max-w-[1200px] w-full">
          {/* Mobile: título do módulo centrado, fora do card */}
          {currentModule && (
            <h2 className="sm:hidden text-center text-sm font-bold uppercase tracking-[0.16em] text-foreground">
              {currentModule.title}
            </h2>
          )}

          {/* Desktop: título + descrição da lição */}
          <div className="hidden sm:block">
            <h1 className="text-2xl font-bold">{currentLesson.title}</h1>
            {currentLesson.description && (
              <p className="text-sm text-muted-foreground mt-1">{currentLesson.description}</p>
            )}
          </div>

          {/* Card da formação — em mobile o vídeo cola ao topo do card (estilo
              card de imóvel) com a info por baixo; em desktop o wrapper é invisível. */}
          <div className="space-y-6 max-sm:space-y-0 max-sm:rounded-2xl max-sm:bg-card max-sm:ring-1 max-sm:ring-black/[0.06] max-sm:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.22)] max-sm:overflow-hidden dark:max-sm:ring-white/10">

          {/* Lesson Content */}
          {mainContent}

          {/* Corpo do card (mobile): título à esquerda + acções */}
          <div className="space-y-6 max-sm:space-y-4 max-sm:px-5 max-sm:pt-4 max-sm:pb-5">

          {/* Mobile: título da lição dentro do card, alinhado à esquerda */}
          <h1 className="sm:hidden text-xl font-bold tracking-tight">{currentLesson.title}</h1>

          {/* Materiais de Apoio */}
          <LessonMaterials lessonId={lessonId} courseId={courseId} />

          {/* Rating + Comentar (mobile slot) + Navigation + Complete */}
          <LessonRating
            lessonId={lessonId}
            courseId={courseId}
            commentSlot={
              <Button
                variant="ghost"
                className="h-10 rounded-full gap-2 bg-muted/60 px-5 backdrop-blur-sm shadow-sm hover:bg-muted"
                onClick={() => setComposeCommentOpen(true)}
              >
                <MessageSquare className="h-4 w-4" />
                Comentar
              </Button>
            }
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

          {/* Comments — lista inline; em mobile o composer vive no sheet */}
          <LessonComments
            lessonId={lessonId}
            courseId={courseId}
            composeSheetOpen={composeCommentOpen}
            onComposeSheetOpenChange={setComposeCommentOpen}
          />

          </div>{/* /Corpo do card */}
          </div>{/* /Card da formação */}
        </div>
      </div>

      {/* Barra inferior fixa — só mobile: Aulas à esquerda, navegação à direita */}
      <div className="sm:hidden shrink-0 flex items-center gap-2 border-t border-border/40 bg-background/90 px-3 py-2.5 backdrop-blur-xl">
        <Button
          variant="ghost"
          size="sm"
          className="h-10 shrink-0 gap-1.5 rounded-full bg-muted/60 px-4 shadow-sm hover:bg-muted"
          onClick={() => setCurriculumOpen(true)}
        >
          <ListVideo className="h-4 w-4" />
          Aulas
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1}/{allLessons.length}
          </span>
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {prevLesson ? (
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="h-10 w-10 shrink-0 rounded-full bg-muted/60 shadow-sm hover:bg-muted"
            >
              <Link href={`/dashboard/formacoes/cursos/${courseId}/licoes/${prevLesson.id}`} aria-label="Lição anterior">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="icon" disabled className="h-10 w-10 shrink-0 rounded-full bg-muted/40">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {nextLesson ? (
            <Button
              size="icon"
              asChild
              className="h-10 w-10 shrink-0 rounded-full bg-neutral-900/85 text-white shadow-sm backdrop-blur-md hover:bg-neutral-900/70 dark:bg-white/90 dark:text-neutral-900 dark:hover:bg-white/75"
            >
              <Link href={`/dashboard/formacoes/cursos/${courseId}/licoes/${nextLesson.id}`} aria-label="Próxima lição">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button size="icon" disabled className="h-10 w-10 shrink-0 rounded-full bg-muted/40 text-muted-foreground">
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <LessonCurriculumSheet
        open={curriculumOpen}
        onOpenChange={setCurriculumOpen}
        modules={sidebarModules}
        currentLessonId={lessonId}
        courseId={courseId}
        courseTitle={course.title}
        progressPercent={course.enrollment?.progress_percent || 0}
      />
      </div>{/* /Main column */}
    </div>
  )
}
