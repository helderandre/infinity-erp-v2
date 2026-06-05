'use client'

import { SubtaskCardBase } from './subtask-card-base'
import { FieldSubtaskInline } from './field-subtask-inline'
import { TextCursorInput } from 'lucide-react'
import type { ProcSubtask } from '@/types/subtask'

interface SubtaskCardFieldProps {
  subtask: ProcSubtask
  processId: string
  taskId: string
  onCompleted: () => Promise<void>
}

export function SubtaskCardField({
  subtask,
  processId,
  taskId,
  onCompleted,
}: SubtaskCardFieldProps) {
  return (
    <SubtaskCardBase
      subtask={subtask}
      state={subtask.is_completed ? 'completed' : 'pending'}
      icon={<TextCursorInput className="h-4 w-4 text-cyan-500" />}
      typeLabel="Campo"
    >
      <div className="mt-2">
        {subtask.is_blocked ? (
          <p className="text-xs text-muted-foreground italic">Bloqueada — aguarda dependência</p>
        ) : (
          <FieldSubtaskInline
            subtask={subtask}
            processId={processId}
            taskId={taskId}
            onCompleted={onCompleted}
          />
        )}
      </div>
    </SubtaskCardBase>
  )
}
