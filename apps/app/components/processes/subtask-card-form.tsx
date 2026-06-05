'use client'

import { SubtaskCardBase } from './subtask-card-base'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, Eye, Pencil } from 'lucide-react'
import type { ProcSubtask } from '@/types/subtask'

interface SubtaskCardFormProps {
  subtask: ProcSubtask
  onOpenSheet: (subtask: ProcSubtask) => void
  onViewSheet: (subtask: ProcSubtask) => void
  onRevert: (subtaskId: string) => void
}

export function SubtaskCardForm({
  subtask,
  onOpenSheet,
  onViewSheet,
  onRevert,
}: SubtaskCardFormProps) {
  const sectionCount = (subtask.config?.sections as unknown[])?.length ?? 0
  const fieldCount = Array.isArray(subtask.config?.sections)
    ? (subtask.config.sections as { fields: unknown[] }[]).reduce((sum, s) => sum + (s.fields?.length ?? 0), 0)
    : 0

  return (
    <SubtaskCardBase
      subtask={subtask}
      state={subtask.is_completed ? 'completed' : 'pending'}
      icon={<ClipboardList className="h-4 w-4 text-teal-500" />}
      typeLabel="Formulário"
    >
      <div className="flex items-center gap-2 mt-2">
        {subtask.is_completed ? (
          <>
            <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">
              Preenchido
            </Badge>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-orange-600 hover:text-orange-700 rounded-full"
              onClick={() => onRevert(subtask.id)}
            >
              Reverter
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs rounded-full"
              onClick={() => onViewSheet(subtask)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Visualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs rounded-full"
              onClick={() => onOpenSheet(subtask)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Editar
            </Button>
          </>
        ) : (
          <>
            <div className="flex-1" />
            <Button
              size="sm"
              className="h-7 text-xs rounded-full"
              disabled={subtask.is_blocked}
              onClick={() => onOpenSheet(subtask)}
            >
              <ClipboardList className="h-3.5 w-3.5 mr-1" />
              Preencher
            </Button>
          </>
        )}
      </div>
    </SubtaskCardBase>
  )
}
