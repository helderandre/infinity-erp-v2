'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  ListVideo,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/use-permissions'
import { WATCH_GATE_PERCENT } from '@/lib/training/watch-gate'
import { LessonReportDialog } from './lesson-report-dialog'
import { LessonMaterials } from './lesson-materials'
import { LessonComments } from './lesson-comments'
import { LessonRatingStars } from './lesson-rating-stars'
import { LessonCurriculumSheet } from './lesson-curriculum-sheet'

interface LessonMobileViewProps {
  mainContent: React.ReactNode
  isVideoMain: boolean
  lesson: {
    title: string
    description?: string | null
    content_type: string
    estimated_minutes?: number | null
  }
  moduleTitle?: string | null
  courseId: string
  lessonId: string
  // curriculum (bottom sheet)
  sidebarModules: React.ComponentProps<typeof LessonCurriculumSheet>['modules']
  courseTitle: string
  progressPercent: number
  position: { index: number; total: number }
  // navigation + completion (bottom action bar)
  prevLesson?: { id: string; title: string } | null
  nextLesson?: { id: string; title: string } | null
  isCompleted?: boolean
  onMarkCompleted?: () => void
  isSaving?: boolean
  watchPercent?: number
}

type MobileTab = 'conteudo' | 'materiais'

const lessonHref = (courseId: string, id: string) =>
  `/dashboard/formacoes/cursos/${courseId}/licoes/${id}`

export function LessonMobileView({
  mainContent,
  isVideoMain,
  lesson,
  moduleTitle,
  courseId,
  lessonId,
  sidebarModules,
  courseTitle,
  progressPercent,
  position,
  prevLesson,
  nextLesson,
  isCompleted,
  onMarkCompleted,
  isSaving,
  watchPercent = 0,
}: LessonMobileViewProps) {
  const [tab, setTab] = useState<MobileTab>('conteudo')
  const [curriculumOpen, setCurriculumOpen] = useState(false)

  const { hasPermission } = usePermissions()
  const isTrainingAdmin = hasPermission('training')
  const isVideoLesson = lesson.content_type === 'video'
  const belowGate =
    isVideoLesson && !isTrainingAdmin && watchPercent < WATCH_GATE_PERCENT
  const completeDisabled = Boolean(isSaving) || belowGate

  const metaLine = [
    moduleTitle,
    lesson.estimated_minutes ? `${lesson.estimated_minutes} min` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Scrollable area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center gap-1 border-b bg-background/90 px-1.5 py-1.5 backdrop-blur">
          <Button variant="ghost" size="icon" asChild className="h-9 w-9 shrink-0 rounded-full">
            <Link href={`/dashboard/formacoes/cursos/${courseId}`} aria-label="Voltar ao curso">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <span className="flex-1 truncate text-sm font-medium">{lesson.title}</span>
          <LessonReportDialog lessonId={lessonId} courseId={courseId} />
        </div>

        {/* Main content — full-bleed for video */}
        {isVideoMain ? (
          <div className="bg-black [&_video]:rounded-none">{mainContent}</div>
        ) : (
          <div className="px-4 pt-4">{mainContent}</div>
        )}

        {/* Lesson header */}
        <div className="px-4 pt-4">
          <h1 className="text-lg font-bold leading-tight">{lesson.title}</h1>
          {metaLine && <p className="mt-1 text-xs text-muted-foreground">{metaLine}</p>}
        </div>

        {/* Pill tabs */}
        <div className="px-4 pt-4">
          <div className="inline-flex items-center gap-1 rounded-full bg-muted/60 p-1">
            {(
              [
                { key: 'conteudo', label: 'Conteúdo' },
                { key: 'materiais', label: 'Materiais' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  tab === t.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="px-4 pt-4">
          {tab === 'conteudo' && (
            <div className="space-y-5">
              {lesson.description ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {lesson.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground/70">Sem descrição.</p>
              )}
              <LessonRatingStars lessonId={lessonId} />
            </div>
          )}
          {tab === 'materiais' && <LessonMaterials lessonId={lessonId} courseId={courseId} />}
        </div>

        {/* Comments — always below the tabs */}
        <div className="px-4 pb-6 pt-8">
          <LessonComments lessonId={lessonId} courseId={courseId} />
        </div>
      </div>

      {/* Watch-gate hint (mobile has no hover tooltip) */}
      {belowGate && (
        <div className="shrink-0 bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          Assista a {WATCH_GATE_PERCENT}% do vídeo para concluir ({Math.round(watchPercent)}%)
        </div>
      )}

      {/* Fixed bottom action bar */}
      <div className="flex shrink-0 items-center gap-2 border-t bg-background/95 px-3 py-2.5 backdrop-blur">
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 rounded-full"
          onClick={() => setCurriculumOpen(true)}
        >
          <ListVideo className="h-4 w-4" />
          Aulas
          <span className="text-xs text-muted-foreground">
            {position.index}/{position.total}
          </span>
        </Button>

        <div className="ml-auto flex items-center gap-1.5">
          {prevLesson ? (
            <Button variant="outline" size="icon" asChild className="h-9 w-9 shrink-0 rounded-full">
              <Link href={lessonHref(courseId, prevLesson.id)} aria-label="Lição anterior">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon" disabled className="h-9 w-9 shrink-0 rounded-full">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-4 w-4" />
              Concluída
            </span>
          ) : (
            <Button
              size="sm"
              className="rounded-full"
              onClick={onMarkCompleted}
              disabled={completeDisabled}
            >
              {isSaving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
              )}
              Concluir
            </Button>
          )}

          {nextLesson ? (
            <Button variant="outline" size="icon" asChild className="h-9 w-9 shrink-0 rounded-full">
              <Link href={lessonHref(courseId, nextLesson.id)} aria-label="Próxima lição">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon" disabled className="h-9 w-9 shrink-0 rounded-full">
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
        courseTitle={courseTitle}
        progressPercent={progressPercent}
      />
    </div>
  )
}
