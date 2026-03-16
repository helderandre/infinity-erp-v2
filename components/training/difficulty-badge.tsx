'use client'

import { Badge } from '@/components/ui/badge'
import { TRAINING_DIFFICULTY_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { CourseDifficulty } from '@/types/training'

interface DifficultyBadgeProps {
  difficulty: CourseDifficulty
  className?: string
}

export function DifficultyBadge({ difficulty, className }: DifficultyBadgeProps) {
  const colors = TRAINING_DIFFICULTY_COLORS[difficulty]

  return (
    <Badge
      variant="outline"
      className={cn(colors.bg, colors.text, 'border-transparent font-medium', className)}
    >
      {colors.label}
    </Badge>
  )
}
