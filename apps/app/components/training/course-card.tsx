'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { TRAINING_DIFFICULTY_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Award, CheckCircle2, Clock, User } from 'lucide-react'
import type { TrainingCourse } from '@/types/training'
import { CourseProgressBar } from './course-progress-bar'
import { DifficultyBadge } from './difficulty-badge'

interface CourseCardProps {
  course: TrainingCourse
  onClick?: () => void
  showProgress?: boolean
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function CourseCard({ course, onClick, showProgress }: CourseCardProps) {
  const categoryColor = course.category?.color || '#6366f1'
  const isCompleted = course.enrollment?.status === 'completed'
  const instructorName =
    course.instructor?.commercial_name || course.instructor_name || 'Sem instrutor'

  return (
    <Card
      className={cn(
        'group relative cursor-pointer overflow-hidden transition-all duration-200 hover:scale-[1.01] hover:shadow-md py-0 gap-0',
        isCompleted && 'ring-2 ring-emerald-500/30'
      )}
      onClick={onClick}
    >
      {/* Cover image / gradient placeholder */}
      <div className="relative h-40 w-full overflow-hidden">
        {course.cover_image_url ? (
          <img
            src={course.cover_image_url}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${categoryColor}33, ${categoryColor}88)`,
            }}
          />
        )}

        {/* Category badge (top-left) */}
        {course.category && (
          <Badge
            className="absolute top-2 left-2 border-transparent text-primary-foreground shadow-sm"
            style={{ backgroundColor: categoryColor }}
          >
            {course.category.name}
          </Badge>
        )}

        {/* Difficulty badge (top-right) */}
        <div className="absolute top-2 right-2">
          <DifficultyBadge difficulty={course.difficulty_level} />
        </div>

        {/* Completed overlay */}
        {isCompleted && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20">
            <div className="rounded-full bg-emerald-500 p-2 shadow-lg">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
          </div>
        )}
      </div>

      <CardContent className="space-y-3 p-4">
        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
          {course.title}
        </h3>

        {/* Instructor + duration */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {instructorName}
          </span>
          {course.estimated_duration_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(course.estimated_duration_minutes)}
            </span>
          )}
        </div>

        {/* Tags: Obrigatorio / Certificado */}
        <div className="flex flex-wrap gap-1.5">
          {course.is_mandatory && (
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-transparent text-[10px] px-1.5 py-0">
              Obrigatório
            </Badge>
          )}
          {course.has_certificate && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-transparent text-[10px] px-1.5 py-0">
              <Award className="mr-1 h-3 w-3" />
              Certificado
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        {showProgress && course.enrollment && !isCompleted && (
          <CourseProgressBar
            percent={course.enrollment.progress_percent}
            size="sm"
            showLabel
          />
        )}
      </CardContent>
    </Card>
  )
}
