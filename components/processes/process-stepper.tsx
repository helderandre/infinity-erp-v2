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
  // Encontrar o passo activo (in_progress) ou o último se todos completos
  const activeStage = stages.find((s) => s.status === 'in_progress')
  const activeValue = activeStage
    ? activeStage.name
    : stages.every((s) => s.status === 'completed')
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
            key={stage.name}
            value={stage.name}
            completed={stage.status === 'completed'}
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
