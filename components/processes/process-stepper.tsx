import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProcessStageWithTasks } from '@/types/process'

interface ProcessStepperProps {
  stages: ProcessStageWithTasks[]
  className?: string
}

export function ProcessStepper({ stages, className }: ProcessStepperProps) {
  return (
    <nav aria-label="Progresso" className={className}>
      <ol className="flex items-center justify-between">
        {stages.map((stage, index) => {
          const isCompleted = stage.status === 'completed'
          const isInProgress = stage.status === 'in_progress'
          const isPending = stage.status === 'pending'
          const isLast = index === stages.length - 1

          return (
            <li key={index} className="relative flex-1">
              {/* Linha de conexão */}
              {!isLast && (
                <div
                  className={cn(
                    'absolute top-4 left-1/2 h-0.5 w-full -translate-y-1/2',
                    isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                  )}
                  aria-hidden="true"
                />
              )}

              <div className="group relative flex flex-col items-center">
                {/* Círculo */}
                <span
                  className={cn(
                    'relative z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                    isCompleted &&
                      'bg-emerald-500 text-white',
                    isInProgress &&
                      'border-2 border-blue-500 bg-white text-blue-500',
                    isPending && 'border-2 border-slate-300 bg-white text-slate-400'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-xs font-semibold">
                      {index + 1}
                    </span>
                  )}
                </span>

                {/* Nome da fase */}
                <span
                  className={cn(
                    'mt-2 text-xs font-medium text-center max-w-[120px]',
                    isCompleted && 'text-emerald-700',
                    isInProgress && 'text-blue-700',
                    isPending && 'text-slate-500'
                  )}
                >
                  {stage.name}
                </span>

                {/* Progresso */}
                <span className="mt-0.5 text-xs text-slate-400">
                  {stage.tasks_completed}/{stage.tasks_total}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
