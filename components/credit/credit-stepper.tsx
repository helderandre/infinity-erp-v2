'use client'

import { cn } from '@/lib/utils'
import { CREDIT_STATUS_PIPELINE, CREDIT_STATUS_COLORS } from '@/lib/constants'
import { Check } from 'lucide-react'

interface CreditStepperProps {
  currentStatus: string
}

const TERMINAL_STATUSES = ['recusado', 'desistencia']

export function CreditStepper({ currentStatus }: CreditStepperProps) {
  const isTerminal = TERMINAL_STATUSES.includes(currentStatus)
  const currentIndex = CREDIT_STATUS_PIPELINE.indexOf(
    currentStatus as (typeof CREDIT_STATUS_PIPELINE)[number]
  )

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-start justify-between min-w-[700px] px-2">
        {CREDIT_STATUS_PIPELINE.map((step, index) => {
          const config = CREDIT_STATUS_COLORS[step]
          const isPast = currentIndex > index
          const isCurrent = currentIndex === index
          const isFuture = !isPast && !isCurrent
          const isLast = index === CREDIT_STATUS_PIPELINE.length - 1

          return (
            <div key={step} className="flex flex-1 items-start">
              <div className="flex flex-col items-center gap-1.5">
                {/* Circle */}
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                    isPast && 'border-emerald-500 bg-emerald-500 text-white',
                    isCurrent && !isTerminal && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && isTerminal && 'border-red-500 bg-red-500 text-white',
                    isFuture && 'border-muted-foreground/30 bg-muted text-muted-foreground'
                  )}
                >
                  {isPast ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'text-[10px] font-medium text-center max-w-[80px] leading-tight',
                    isPast && 'text-emerald-600',
                    isCurrent && !isTerminal && 'text-primary',
                    isCurrent && isTerminal && 'text-red-600',
                    isFuture && 'text-muted-foreground'
                  )}
                >
                  {config?.label ?? step}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'mt-4 h-0.5 flex-1 mx-1',
                    isPast ? 'bg-emerald-500' : 'bg-muted-foreground/20'
                  )}
                />
              )}
            </div>
          )
        })}

        {/* Terminal status indicator */}
        {isTerminal && (
          <div className="flex flex-col items-center gap-1.5 ml-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-red-500 bg-red-500 text-white text-xs font-semibold">
              !
            </div>
            <span className="text-[10px] font-medium text-red-600 text-center max-w-[80px] leading-tight">
              {CREDIT_STATUS_COLORS[currentStatus]?.label ?? currentStatus}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
