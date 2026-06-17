'use client'

import { cn } from '@/lib/utils'
import { Check, Loader2 } from 'lucide-react'
import { ANGARIACAO_STEPS, type AngariacaoStep } from './steps'

export type StepStatus = 'done' | 'current' | 'pending'

/**
 * `progressOrder` = ordem do passo em curso (1..N). N+1 → todos concluídos.
 * Passos com order < progressOrder estão concluídos.
 */
export function getStepStatus(
  step: AngariacaoStep,
  progressOrder: number
): StepStatus {
  if (step.order < progressOrder) return 'done'
  if (step.order === progressOrder) return 'current'
  return 'pending'
}

interface ProcessTimelineProps {
  /** quão longe o processo avançou (estado real) */
  progressOrder: number
  /** qual passo está seleccionado (navegação/vista) — apenas realça */
  selectedOrder?: number
  steps?: AngariacaoStep[]
  onStepClick?: (step: AngariacaoStep) => void
  /** 'responsive' (default) | 'horizontal' | 'vertical' */
  view?: 'responsive' | 'horizontal' | 'vertical'
  className?: string
}

export function ProcessTimeline({
  progressOrder,
  selectedOrder,
  steps = ANGARIACAO_STEPS,
  onStepClick,
  view = 'responsive',
  className,
}: ProcessTimelineProps) {
  const horizontal = (
    <Horizontal
      steps={steps}
      progressOrder={progressOrder}
      selectedOrder={selectedOrder}
      onStepClick={onStepClick}
    />
  )
  const vertical = (
    <Vertical
      steps={steps}
      progressOrder={progressOrder}
      selectedOrder={selectedOrder}
      onStepClick={onStepClick}
    />
  )

  if (view === 'horizontal') return <div className={className}>{horizontal}</div>
  if (view === 'vertical') return <div className={className}>{vertical}</div>

  return (
    <div className={className}>
      <div className="hidden md:block">{horizontal}</div>
      <div className="md:hidden">{vertical}</div>
    </div>
  )
}

function Node({
  status,
  selected,
  icon: Icon,
}: {
  status: StepStatus
  selected?: boolean
  icon: AngariacaoStep['icon']
}) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors',
        status === 'done' && 'border-emerald-500 bg-emerald-500 text-white',
        status === 'current' &&
          'border-emerald-500 bg-emerald-500 text-white ring-4 ring-emerald-500/20',
        status === 'pending' && 'border-muted bg-background text-muted-foreground',
        selected && 'outline outline-2 outline-offset-2 outline-foreground/30'
      )}
    >
      {status === 'done' ? (
        <Check className="h-4 w-4" />
      ) : status === 'current' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      )}
    </span>
  )
}

interface InnerProps {
  steps: AngariacaoStep[]
  progressOrder: number
  selectedOrder?: number
  onStepClick?: (step: AngariacaoStep) => void
}

function Horizontal({ steps, progressOrder, selectedOrder, onStepClick }: InnerProps) {
  return (
    <div className="flex items-start">
      {steps.map((step, i) => {
        const status = getStepStatus(step, progressOrder)
        const Icon = step.icon
        return (
          <div key={step.key} className="flex flex-1 flex-col items-center">
            <Icon
              className={cn(
                'mb-3 h-7 w-7',
                status === 'pending'
                  ? 'text-muted-foreground/40'
                  : status === 'current'
                    ? 'text-emerald-500'
                    : 'text-foreground/70'
              )}
              strokeWidth={1.5}
            />
            <div className="relative flex h-9 w-full items-center justify-center">
              {i > 0 && (
                <span
                  className={cn(
                    'absolute left-0 right-1/2 top-1/2 h-0.5 -translate-y-1/2',
                    step.order <= progressOrder ? 'bg-emerald-500' : 'bg-muted'
                  )}
                />
              )}
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    'absolute left-1/2 right-0 top-1/2 h-0.5 -translate-y-1/2',
                    step.order < progressOrder ? 'bg-emerald-500' : 'bg-muted'
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => onStepClick?.(step)}
                className="relative z-10 rounded-full focus:outline-none"
              >
                <Node
                  status={status}
                  selected={selectedOrder === step.order}
                  icon={step.icon}
                />
              </button>
            </div>
            <span
              className={cn(
                'mt-3 text-center text-sm font-semibold',
                status === 'pending'
                  ? 'text-muted-foreground'
                  : status === 'current'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-foreground'
              )}
            >
              {step.shortLabel}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Vertical({ steps, progressOrder, selectedOrder, onStepClick }: InnerProps) {
  return (
    <div className="flex flex-col">
      {steps.map((step, i) => {
        const status = getStepStatus(step, progressOrder)
        const isLast = i === steps.length - 1
        const isSelected = selectedOrder === step.order
        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onStepClick?.(step)}
            className={cn(
              'flex gap-3 rounded-2xl px-2 py-1 text-left transition-colors focus:outline-none',
              isSelected && 'bg-muted/50'
            )}
          >
            <div className="flex flex-col items-center">
              <Node status={status} selected={isSelected} icon={step.icon} />
              {!isLast && (
                <span
                  className={cn(
                    'my-1 min-h-[2.25rem] w-0.5 flex-1',
                    step.order < progressOrder ? 'bg-emerald-500' : 'bg-muted'
                  )}
                />
              )}
            </div>
            <div className={cn('pb-6 pt-1', status === 'pending' && 'opacity-60')}>
              <p
                className={cn(
                  'font-semibold',
                  status === 'current'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-foreground'
                )}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
