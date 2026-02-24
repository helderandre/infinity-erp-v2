'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { TaskUploadAction } from './task-upload-action'
import { TaskFormAction } from './task-form-action'
import {
  PlayCircle,
  CheckCircle2,
  Ban,
  RotateCcw,
  Loader2,
  Mail,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import type { ProcessTask, ProcessDocument, ProcessOwner } from '@/types/process'
import type { ProcSubtask } from '@/types/subtask'

interface TaskDetailActionsProps {
  task: ProcessTask
  processId: string
  propertyId: string
  processDocuments?: ProcessDocument[]
  owners?: ProcessOwner[]
  onTaskUpdate: () => void
}

export function TaskDetailActions({
  task,
  processId,
  propertyId,
  processDocuments = [],
  owners = [],
  onTaskUpdate,
}: TaskDetailActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [showBypassInput, setShowBypassInput] = useState(false)
  const [bypassReason, setBypassReason] = useState('')

  const mainOwnerId = owners.find((o) => o.is_main_contact)?.id || owners[0]?.id

  const handleAction = async (action: string, extra?: Record<string, unknown>) => {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/processes/${processId}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao executar acção')
      }
      toast.success('Tarefa actualizada com sucesso!')
      onTaskUpdate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao executar acção')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBypassSubmit = async () => {
    if (bypassReason.length < 10) return
    await handleAction('bypass', { bypass_reason: bypassReason })
    setShowBypassInput(false)
    setBypassReason('')
  }

  // Render action-type specific content
  const renderActionContent = () => {
    switch (task.action_type) {
      case 'UPLOAD': {
        const config = task.config as Record<string, unknown> | null
        const docTypeId = config?.doc_type_id as string | undefined
        if (!docTypeId || !['pending', 'in_progress'].includes(task.status ?? '')) return null

        return (
          <TaskUploadAction
            taskId={task.id}
            processId={processId}
            propertyId={propertyId}
            docTypeId={docTypeId}
            docTypeName={(config?.doc_type_name as string) || task.title}
            allowedExtensions={
              (config?.allowed_extensions as string[]) || [
                'pdf',
                'jpg',
                'jpeg',
                'png',
                'doc',
                'docx',
              ]
            }
            existingDocs={processDocuments}
            ownerId={task.owner_id || mainOwnerId}
            onCompleted={onTaskUpdate}
          />
        )
      }

      case 'FORM': {
        if (
          !['pending', 'in_progress'].includes(task.status ?? '') ||
          !task.subtasks ||
          task.subtasks.length === 0
        )
          return null

        return (
          <TaskFormAction
            task={task as ProcessTask & { subtasks: ProcSubtask[] }}
            processId={processId}
            onSubtaskToggle={async (taskId, subtaskId, completed) => {
              const res = await fetch(
                `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtaskId}`,
                {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ is_completed: completed }),
                }
              )
              if (!res.ok) throw new Error('Erro ao actualizar subtarefa')
            }}
            onTaskUpdate={onTaskUpdate}
          />
        )
      }

      case 'EMAIL': {
        const config = task.config as Record<string, unknown> | null
        if (!config) return null

        return (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Template de Email</span>
            </div>
            {config.subject ? (
              <div className="text-sm">
                <span className="text-muted-foreground">Assunto: </span>
                <span className="font-medium">{String(config.subject)}</span>
              </div>
            ) : null}
            {config.body_html ? (
              <div
                className="text-sm text-muted-foreground prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: String(config.body_html) }}
              />
            ) : null}
          </div>
        )
      }

      case 'GENERATE_DOC': {
        const config = task.config as Record<string, unknown> | null
        if (!config) return null

        return (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-violet-600" />
              <span className="font-medium">Template de Documento</span>
            </div>
            {config.doc_name ? (
              <p className="text-sm text-muted-foreground">
                {String(config.doc_name)}
              </p>
            ) : null}
          </div>
        )
      }

      default:
        return null
    }
  }

  // Render state transition buttons
  const renderStateButtons = () => {
    if (task.status === 'completed') {
      return (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          Tarefa concluída em {formatDate(task.completed_at)}
        </div>
      )
    }

    if (task.status === 'skipped') {
      return (
        <div className="space-y-2">
          {task.bypass_reason && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Motivo da dispensa: </span>
              {task.bypass_reason}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('reset')}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Reactivar
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {task.status === 'pending' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('start')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              Iniciar
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handleAction('complete')}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Concluir
          </Button>

          {!task.is_mandatory && !showBypassInput && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBypassInput(true)}
              disabled={isProcessing}
            >
              <Ban className="mr-2 h-4 w-4" />
              Dispensar
            </Button>
          )}
        </div>

        {/* Inline bypass input */}
        {showBypassInput && (
          <div className="space-y-2 rounded-lg border p-3">
            <Textarea
              placeholder="Motivo da dispensa (mín. 10 caracteres)..."
              value={bypassReason}
              onChange={(e) => setBypassReason(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleBypassSubmit}
                disabled={isProcessing || bypassReason.length < 10}
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="mr-2 h-4 w-4" />
                )}
                Confirmar Dispensa
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowBypassInput(false)
                  setBypassReason('')
                }}
                disabled={isProcessing}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Acções</h4>

      {/* Action-type specific content */}
      {renderActionContent()}

      {/* State transition buttons */}
      {renderStateButtons()}
    </div>
  )
}
