'use client'

import { cn } from '@/lib/utils'
import { GOAL_STATUS_COLORS } from '@/lib/constants'
import type { GoalStatus } from '@/types/goal'

interface GoalStatusIndicatorProps {
  status: GoalStatus
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function GoalStatusIndicator({ status, size = 'md', showLabel = false }: GoalStatusIndicatorProps) {
  const config = GOAL_STATUS_COLORS[status]

  const dotSizes = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn(
        'rounded-full',
        dotSizes[size],
        status === 'green' && 'bg-emerald-500',
        status === 'orange' && 'bg-amber-500',
        status === 'red' && 'bg-red-500',
      )} />
      {showLabel && (
        <span className={cn('text-xs font-medium', config.text)}>
          {config.label}
        </span>
      )}
    </div>
  )
}
