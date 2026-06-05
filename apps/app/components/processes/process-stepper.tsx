import type { ProcessStageWithTasks } from '@/types/process'
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper'

interface ProcessStepperProps {
  stages: ProcessStageWithTasks[]
  className?: string
}

export function ProcessStepper({ stages, className }: ProcessStepperProps) {
  // Encontrar o primeiro passo activo (is_current) para o stepper value
  const currentStage = stages.find((s) => s.is_current)
  const activeValue = currentStage
    ? currentStage.name
    : stages.every((s) => s.is_completed_explicit || s.status === 'completed')
      ? stages[stages.length - 1]?.name ?? ''
      : stages[0]?.name ?? ''

  return (
    <Stepper
      value={activeValue}
      nonInteractive
      className={className}
    >
      <StepperList>
        {stages.map((stage) => (
          <StepperItem
            key={stage.id}
            value={stage.name}
            completed={stage.is_completed_explicit || stage.status === 'completed'}
          >
            <StepperTrigger>
              <StepperIndicator />
              <div className="flex flex-col gap-px">
                <StepperTitle>{stage.name}</StepperTitle>
                <StepperDescription>
                  {stage.tasks_completed}/{stage.tasks_total} tarefas
                </StepperDescription>
              </div>
            </StepperTrigger>
            <StepperSeparator />
          </StepperItem>
        ))}
      </StepperList>
    </Stepper>
  )
}
