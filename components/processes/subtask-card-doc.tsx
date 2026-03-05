'use client'

import { Button } from '@/components/ui/button'
import { FileText, Eye, RotateCcw, Edit } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { SubtaskCardBase, type CardState } from './subtask-card-base'
import type { ProcSubtask } from '@/types/subtask'

interface SubtaskCardDocProps {
  subtask: ProcSubtask
  onOpenSheet: (subtask: ProcSubtask) => void
  onRevert: (subtaskId: string) => void
}

export function SubtaskCardDoc({
  subtask, onOpenSheet, onRevert,
}: SubtaskCardDocProps) {
  const hasRendered = !!(subtask.config as Record<string, unknown>).rendered
  const state: CardState = subtask.is_completed ? 'completed' : hasRendered ? 'draft' : 'pending'

  return (
    <SubtaskCardBase
      subtask={subtask}
      state={state}
      icon={<FileText className={cn('h-4 w-4', state === 'completed' ? 'text-emerald-500' : 'text-purple-500')} />}
      typeLabel="Documento"
    >
      <div className="space-y-2 text-xs">
        {/* Completion info */}
        {subtask.is_completed && subtask.completed_at && (
          <p className="text-muted-foreground">
            Concluído em {formatDateTime(subtask.completed_at)}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {!subtask.is_completed && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onOpenSheet(subtask)}
            >
              <Edit className="mr-1 h-3 w-3" />
              {hasRendered ? 'Continuar Edição' : 'Editar Documento'}
            </Button>
          )}

          {subtask.is_completed && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onOpenSheet(subtask)}
              >
                <Eye className="mr-1 h-3 w-3" />
                Ver
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-orange-600 hover:text-orange-700"
                onClick={() => onRevert(subtask.id)}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Reverter
              </Button>
            </>
          )}
        </div>
      </div>
    </SubtaskCardBase>
  )
}
