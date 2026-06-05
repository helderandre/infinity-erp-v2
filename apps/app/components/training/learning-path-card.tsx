'use client'

import { BookOpen, Clock, GraduationCap, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TrainingLearningPath } from '@/types/training'

interface LearningPathCardProps {
  path: TrainingLearningPath
  onClick?: () => void
}

export function LearningPathCard({ path, onClick }: LearningPathCardProps) {
  const isCompleted = path.enrollment?.status === 'completed'
  const isInProgress = path.enrollment?.status === 'in_progress'

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]',
        isCompleted && 'border-emerald-500/30'
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="h-5 w-5 text-primary shrink-0" />
              <h3 className="font-semibold truncate">{path.title}</h3>
            </div>

            {path.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {path.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {path.course_count || 0} cursos
              </span>
              {path.estimated_duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {Math.round(path.estimated_duration_minutes / 60)}h
                </span>
              )}
            </div>

            {path.is_mandatory && (
              <Badge variant="outline" className="mt-2 text-amber-600 border-amber-300 bg-amber-50">
                Obrigatório
              </Badge>
            )}
          </div>

          {isCompleted && (
            <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
          )}
        </div>

        {(isInProgress || isCompleted) && path.enrollment && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">
                {isCompleted ? 'Concluído' : 'Em progresso'}
              </span>
              <span className="font-medium">{path.enrollment.progress_percent}%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isCompleted ? 'bg-emerald-500' : 'bg-primary'
                )}
                style={{ width: `${path.enrollment.progress_percent}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
