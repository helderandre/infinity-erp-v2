'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/kibo-ui/spinner'
import { SubtaskCardBase } from './subtask-card-base'
import type { ProcSubtask } from '@/types/subtask'

interface SubtaskCardChecklistProps {
  subtask: ProcSubtask
  onToggle: (subtaskId: string, completed: boolean) => Promise<void>
}

export function SubtaskCardChecklist({ subtask, onToggle }: SubtaskCardChecklistProps) {
  const [isToggling, setIsToggling] = useState(false)

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      await onToggle(subtask.id, !subtask.is_completed)
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <SubtaskCardBase
      subtask={subtask}
      state={subtask.is_completed ? 'completed' : 'pending'}
      icon={
        isToggling ? (
          <Spinner variant="infinite" size={16} className="text-muted-foreground" />
        ) : (
          <Checkbox
            checked={subtask.is_completed}
            onCheckedChange={handleToggle}
            className="h-4 w-4"
          />
        )
      }
      typeLabel="Checklist"
    >
      {/* Sem conteúdo extra — card compacto */}
      <></>
    </SubtaskCardBase>
  )
}
