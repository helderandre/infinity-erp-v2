'use client'

import { cn } from '@/lib/utils'
import { CREDIT_STATUS_COLORS } from '@/lib/constants'

interface CreditStatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

export function CreditStatusBadge({ status, size = 'md' }: CreditStatusBadgeProps) {
  const config = CREDIT_STATUS_COLORS[status]

  if (!config) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
        {status}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium',
        config.bg,
        config.text,
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
      )}
    >
      <span
        className={cn(
          'rounded-full',
          config.dot,
          size === 'sm' ? 'h-1 w-1' : 'h-1.5 w-1.5'
        )}
        aria-hidden="true"
      />
      {config.label}
    </span>
  )
}
