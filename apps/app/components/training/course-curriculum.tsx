'use client'

import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  AlignLeft,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  ExternalLink,
  FileText,
  Lock,
  Play,
  PlayCircle,
} from 'lucide-react'
import { useState } from 'react'
import type {
  TrainingEnrollment,
  TrainingLesson,
  TrainingModule,
  TrainingQuiz,
  LessonContentType,
  LessonProgressStatus,
} from '@/types/training'

interface CourseCurriculumProps {
  modules: TrainingModule[]
  currentLessonId?: string
  onLessonClick?: (lessonId: string, moduleId: string) => void
  enrollment?: TrainingEnrollment | null
}

const contentTypeIcons: Record<LessonContentType, React.ElementType> = {
  video: Play,
  pdf: FileText,
  text: AlignLeft,
  external_link: ExternalLink,
}

function LessonStatusIcon({ status }: { status?: LessonProgressStatus | null }) {
  if (status === 'completed') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  }
  if (status === 'in_progress') {
    return <PlayCircle className="h-4 w-4 text-primary" />
  }
  return <Circle className="h-4 w-4 text-muted-foreground/50" />
}

function formatMinutes(m: number | null | undefined): string {
  if (!m) return ''
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r > 0 ? `${h}h ${r}min` : `${h}h`
}

function ModuleProgress({ module }: { module: TrainingModule }) {
  const total = module.lesson_count ?? module.lessons?.length ?? 0
  const completed = module.completed_lesson_count ?? 0
  if (total === 0) return null

  return (
    <span className="text-xs text-muted-foreground">
      {completed}/{total} lições concluídas
    </span>
  )
}

function LessonRow({
  lesson,
  moduleId,
  isCurrent,
  isLocked,
  onClick,
}: {
  lesson: TrainingLesson
  moduleId: string
  isCurrent: boolean
  isLocked: boolean
  onClick?: (lessonId: string, moduleId: string) => void
}) {
  const Icon = contentTypeIcons[lesson.content_type] || FileText
  const progressStatus = lesson.progress?.status ?? null

  return (
    <button
      type="button"
      disabled={isLocked}
      onClick={() => onClick?.(lesson.id, moduleId)}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
        'hover:bg-muted/50',
        isCurrent && 'bg-primary/5 ring-1 ring-primary/20',
        isLocked && 'cursor-not-allowed opacity-50'
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        {isLocked ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Icon className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn('truncate font-medium', isCurrent && 'text-primary')}>
          {lesson.title}
        </p>
        {lesson.estimated_minutes && (
          <p className="text-xs text-muted-foreground">
            {formatMinutes(lesson.estimated_minutes)}
          </p>
        )}
      </div>

      {!isLocked && <LessonStatusIcon status={progressStatus} />}
    </button>
  )
}

function QuizRow({
  quiz,
  isLocked,
}: {
  quiz: TrainingQuiz
  isLocked: boolean
}) {
  const bestAttempt = quiz.best_attempt
  const hasPassed = bestAttempt?.passed

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border border-dashed px-3 py-2.5 text-sm',
        isLocked && 'opacity-50'
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
        {isLocked ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ClipboardList className="h-4 w-4 text-amber-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{quiz.title}</p>
        <p className="text-xs text-muted-foreground">
          {quiz.question_count ?? quiz.questions?.length ?? 0} perguntas
          {quiz.time_limit_minutes && ` · ${quiz.time_limit_minutes} min`}
        </p>
      </div>

      {bestAttempt && (
        <Badge
          variant="outline"
          className={cn(
            'border-transparent text-xs',
            hasPassed
              ? 'bg-emerald-500/10 text-emerald-600'
              : 'bg-red-500/10 text-red-600'
          )}
        >
          {Math.round(bestAttempt.score)}%
        </Badge>
      )}
    </div>
  )
}

export function CourseCurriculum({
  modules,
  currentLessonId,
  onLessonClick,
  enrollment,
}: CourseCurriculumProps) {
  const sorted = [...modules].sort((a, b) => a.order_index - b.order_index)

  // Default: first module open, or module containing current lesson
  const defaultOpen = currentLessonId
    ? sorted.find((m) =>
        m.lessons?.some((l) => l.id === currentLessonId)
      )?.id ?? sorted[0]?.id
    : sorted[0]?.id

  const [openModules, setOpenModules] = useState<Record<string, boolean>>(
    defaultOpen ? { [defaultOpen]: true } : {}
  )

  const toggleModule = (id: string) => {
    setOpenModules((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const isEnrolled = !!enrollment

  return (
    <div className="space-y-2">
      {sorted.map((mod, modIndex) => {
        const lessons = [...(mod.lessons ?? [])].sort(
          (a, b) => a.order_index - b.order_index
        )
        const isOpen = openModules[mod.id] ?? false

        return (
          <Collapsible key={mod.id} open={isOpen} onOpenChange={() => toggleModule(mod.id)}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Módulo {modIndex + 1}
                  </span>
                  {isEnrolled && <ModuleProgress module={mod} />}
                </div>
                <p className="mt-0.5 truncate font-semibold">{mod.title}</p>
              </div>
              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-1 space-y-0.5 pl-2">
              {lessons.map((lesson) => {
                const isCurrent = lesson.id === currentLessonId
                // Simple lock logic: not enrolled = locked
                const isLocked = !isEnrolled

                return (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    moduleId={mod.id}
                    isCurrent={isCurrent}
                    isLocked={isLocked}
                    onClick={onLessonClick}
                  />
                )
              })}

              {mod.quiz && (
                <QuizRow quiz={mod.quiz} isLocked={!isEnrolled} />
              )}
            </CollapsibleContent>
          </Collapsible>
        )
      })}

      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum módulo disponível
          </p>
        </div>
      )}
    </div>
  )
}
