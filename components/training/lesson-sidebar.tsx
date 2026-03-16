'use client'

import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  FileText,
  LinkIcon,
  PlayCircle,
  Video,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LessonSidebarProps {
  modules: Array<{
    id: string
    title: string
    lessons: Array<{
      id: string
      title: string
      content_type: string
      estimated_minutes?: number | null
      progress?: { status: string } | null
    }>
  }>
  currentLessonId: string
  courseId: string
  courseTitle: string
  progressPercent: number
}

const contentTypeIcons: Record<string, typeof Video> = {
  video: Video,
  pdf: FileText,
  text: FileText,
  external_link: LinkIcon,
}

function getStatusIcon(status?: string | null) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
    case 'in_progress':
      return <PlayCircle className="h-4 w-4 shrink-0 text-blue-500" />
    default:
      return <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
  }
}

export function LessonSidebar({
  modules,
  currentLessonId,
  courseId,
  courseTitle,
  progressPercent,
}: LessonSidebarProps) {
  return (
    <div className="flex h-full flex-col border-r bg-muted/30">
      {/* Header */}
      <div className="space-y-3 border-b p-4">
        <Link
          href={`/dashboard/formacoes/cursos/${courseId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao curso
        </Link>
        <h2 className="line-clamp-2 text-sm font-semibold leading-tight">{courseTitle}</h2>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso geral</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </div>

      {/* Modules & Lessons */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {modules.map((module, moduleIndex) => (
            <div key={module.id} className="mb-3">
              <div className="px-2 py-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Módulo {moduleIndex + 1}
                </p>
                <p className="text-sm font-medium leading-tight">{module.title}</p>
              </div>

              <div className="mt-1 space-y-0.5">
                {module.lessons.map((lesson) => {
                  const isCurrent = lesson.id === currentLessonId
                  const ContentIcon = contentTypeIcons[lesson.content_type] ?? FileText

                  return (
                    <Link
                      key={lesson.id}
                      href={`/dashboard/formacoes/cursos/${courseId}/licoes/${lesson.id}`}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
                        isCurrent
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      )}
                    >
                      {getStatusIcon(lesson.progress?.status)}
                      <ContentIcon
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          isCurrent ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}
                      />
                      <span className="line-clamp-1 flex-1">{lesson.title}</span>
                      {lesson.estimated_minutes && (
                        <span
                          className={cn(
                            'shrink-0 text-xs',
                            isCurrent ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          )}
                        >
                          {lesson.estimated_minutes} min
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
