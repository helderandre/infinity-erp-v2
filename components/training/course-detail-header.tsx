'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  PlayCircle,
} from 'lucide-react'
import type { TrainingCourse } from '@/types/training'
import { BookmarkButton } from './bookmark-button'
import { CourseProgressBar } from './course-progress-bar'
import { DifficultyBadge } from './difficulty-badge'

interface CourseDetailHeaderProps {
  course: TrainingCourse
  onEnroll?: () => void
  onContinue?: () => void
  onBookmark?: () => void
  isBookmarked?: boolean
  isEnrolling?: boolean
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function CourseDetailHeader({
  course,
  onEnroll,
  onContinue,
  onBookmark,
  isBookmarked = false,
  isEnrolling = false,
}: CourseDetailHeaderProps) {
  const categoryColor = course.category?.color || '#6366f1'
  const enrollment = course.enrollment
  const isCompleted = enrollment?.status === 'completed'
  const isEnrolled = !!enrollment
  const isInProgress =
    enrollment?.status === 'in_progress' || enrollment?.status === 'enrolled'
  const instructorName =
    course.instructor?.commercial_name || course.instructor_name || 'Sem instrutor'

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card">
      {/* Background cover / gradient */}
      <div className="relative h-48 w-full overflow-hidden sm:h-56">
        {course.cover_image_url ? (
          <img
            src={course.cover_image_url}
            alt={course.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${categoryColor}44, ${categoryColor}aa)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
      </div>

      {/* Content overlay */}
      <div className="relative -mt-20 px-6 pb-6 sm:-mt-24 sm:px-8">
        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {course.title}
        </h1>

        {/* Instructor */}
        <div className="mt-3 flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">
              {getInitials(instructorName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">{instructorName}</span>
        </div>

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {course.category && (
            <Badge
              className="border-transparent text-white"
              style={{ backgroundColor: categoryColor }}
            >
              {course.category.name}
            </Badge>
          )}

          <DifficultyBadge difficulty={course.difficulty_level} />

          {course.estimated_duration_minutes && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatDuration(course.estimated_duration_minutes)}
            </span>
          )}

          {course.module_count != null && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              {course.module_count} {course.module_count === 1 ? 'módulo' : 'módulos'}
            </span>
          )}

          {course.lesson_count != null && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              {course.lesson_count} {course.lesson_count === 1 ? 'lição' : 'lições'}
            </span>
          )}

          {course.has_certificate && (
            <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-500/10 text-blue-600">
              <Award className="h-3.5 w-3.5" />
              Certificado
            </Badge>
          )}
        </div>

        {/* Progress bar (if enrolled) */}
        {isEnrolled && !isCompleted && (
          <div className="mt-4 max-w-md">
            <CourseProgressBar
              percent={enrollment!.progress_percent}
              size="md"
              showLabel
            />
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center gap-3">
          {isCompleted ? (
            <Button variant="outline" className="gap-2 text-emerald-600" disabled>
              <CheckCircle2 className="h-4 w-4" />
              Concluído
            </Button>
          ) : isInProgress ? (
            <Button onClick={onContinue} className="gap-2">
              <PlayCircle className="h-4 w-4" />
              Continuar Formação
            </Button>
          ) : (
            <Button onClick={onEnroll} disabled={isEnrolling} className="gap-2">
              {isEnrolling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              Inscrever-se
            </Button>
          )}

          {onBookmark && (
            <BookmarkButton isBookmarked={isBookmarked} onToggle={onBookmark} />
          )}
        </div>
      </div>
    </div>
  )
}
