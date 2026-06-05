'use client'

import { cn } from '@/lib/utils'

interface CourseProgressBarProps {
  percent: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const sizeMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

export function CourseProgressBar({
  percent,
  size = 'md',
  showLabel = false,
  className,
}: CourseProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full rounded-full bg-muted overflow-hidden', sizeMap[size])}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            clamped === 100 ? 'bg-emerald-500' : 'bg-primary'
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <p className="mt-1 text-xs text-muted-foreground">
          {Math.round(clamped)}% concluído
        </p>
      )}
    </div>
  )
}
